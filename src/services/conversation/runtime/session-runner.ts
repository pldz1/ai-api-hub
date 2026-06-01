import store from "@/store";
import { ChatGateway } from "@/ai-capability";
import { getUuid } from "@/utils";
import { tr } from "@/i18n";
import type { ChatPromptMessage, ChatResponseDelta } from "@/types";
import { addMessage } from "../conversation";
import { AssistantStreamState, AssistantDraftContent } from "../rendering/assistant-stream-state";
import { createChatTurnMessages, createChatRequest, getConversationMessageFormat, getConversationSystemPrompts } from "./chat-context";

type ChatRuntimeStatus = "idle" | "loading" | "streaming" | "success" | "error" | "stopped";

class ChatSessionRunner {
  chatId: string;
  client: ChatGateway;
  assistantStream: AssistantStreamState;
  onDraftUpdate: ((content: AssistantDraftContent) => void) | null = null;
  onDraftRemove: (() => void) | null = null;
  onMessagePersisted: (() => void | Promise<void>) | null = null;
  onRuntimeUpdate: ((runtime: Record<string, unknown>) => void) | null = null;

  constructor(chatId: string) {
    this.chatId = chatId;
    this.client = new ChatGateway();
    this.assistantStream = new AssistantStreamState();

    this.enqueueProviderDelta = this.enqueueProviderDelta.bind(this);
  }

  getSessionContext() {
    return createChatRequest(this.chatId);
  }

  updateRuntime(runtime = {}) {
    store.dispatch("setChatRuntime", {
      cid: this.chatId,
      runtime,
    });
    this.onRuntimeUpdate?.(runtime);
  }

  clearDraft(status: ChatRuntimeStatus = "idle", extra = {}) {
    const completedInBackground = ["success", "error", "stopped"].includes(status) && store.state.curChatId !== this.chatId;
    this.updateRuntime({
      status,
      pending: false,
      completedNotice: completedInBackground,
      draftMessageId: "",
      draftAssistantContent: "",
      draftReasoningContent: "",
      ...extra,
    });
    this.onDraftRemove?.();
  }

  updateDraftRuntime(status: ChatRuntimeStatus) {
    this.updateRuntime({
      status,
      pending: false,
      draftMessageId: this.assistantStream.messageId,
      draftAssistantContent: this.assistantStream.content.content,
      draftReasoningContent: this.assistantStream.content.reasoning_content,
      lastError: this.assistantStream.lastError,
    });
  }

  async persistAssistantMessage() {
    if (!this.assistantStream.hasContent()) return false;

    const assistantData: ChatPromptMessage = {
      role: "assistant",
      content: [{ type: "text", text: this.assistantStream.content.content }],
      reasoning_content: this.assistantStream.content.reasoning_content,
      mid: this.assistantStream.messageId,
      meta: {
        isContextBlocked: this.assistantStream.hasError || undefined,
      },
    };
    if (this.assistantStream.tokenUsage) assistantData.token_usage = this.assistantStream.tokenUsage;

    await store.dispatch("pushChatMessage", {
      cid: this.chatId,
      msg: {
        ...assistantData,
        mid: this.assistantStream.messageId,
      },
    });
    await addMessage(this.chatId, this.assistantStream.messageId, assistantData);
    await this.onMessagePersisted?.();
    return true;
  }

  enqueueProviderDelta(delta: ChatResponseDelta): void {
    if (this.assistantStream.forceStopped) return;

    this.assistantStream.applyDelta(delta);
    this.onDraftUpdate?.(this.assistantStream.content);

    if (delta.kind === "error") {
      this.updateDraftRuntime("error");
    }
  }

  async chat(data: ChatPromptMessage): Promise<void> {
    this.assistantStream.reset(getUuid("msg"));

    const context = this.getSessionContext();
    const userMessage = { ...data, mid: getUuid("msg") };

    await store.dispatch("pushChatMessage", {
      cid: this.chatId,
      msg: userMessage,
    });
    await addMessage(this.chatId, userMessage.mid, userMessage);
    await this.onMessagePersisted?.();

    const history = (store.state.chatMessagesById?.[this.chatId] || []).filter((msg) => !msg.meta?.isContextBlocked);
    const settings = store.state.chatSettingsById?.[this.chatId] || store.state.curChatModelSettings;
    const passedMsgLen = Number(settings?.passedMsgLen || history.length || 1);
    const messages = history.slice(-Math.min(passedMsgLen, history.length));
    const packedMessages = createChatTurnMessages(messages, getConversationSystemPrompts(this.chatId), getConversationMessageFormat(context.model));
    const request = {
      ...context,
      capabilities: messages[messages.length - 1]?.meta?.usedCapabilities || {},
    };

    this.updateRuntime({
      status: "loading",
      pending: true,
      draftMessageId: this.assistantStream.messageId,
      draftAssistantContent: "",
      draftReasoningContent: "",
      lastError: "",
    });

    this.client.init(request.model);
    const stream = this.client.chat(packedMessages, request);
    let next = await stream.next();
    while (!next.done) {
      this.enqueueProviderDelta(next.value as ChatResponseDelta);
      next = await stream.next();
    }
    const completed = Boolean(next.value);

    if (this.assistantStream.forceStopped) {
      this.clearDraft("stopped");
      return;
    }

    if (this.assistantStream.hasError) {
      if (this.assistantStream.hasContent()) {
        await this.persistAssistantMessage();
      } else {
        this.assistantStream.content.content = this.assistantStream.lastError || tr("toast.modelRequestFailed", { error: "" });
        await this.persistAssistantMessage();
      }
      this.clearDraft("error", { lastError: this.assistantStream.lastError || tr("toast.modelRequestFailed", { error: "" }) });
      return;
    }

    if (!completed) {
      this.clearDraft("error");
      return;
    }

    if (!this.assistantStream.content.content) {
      debugger;
      this.assistantStream.content.content = tr("chat.timeoutNoContent");
    }

    await this.persistAssistantMessage();
    this.clearDraft("success");
  }

  stop(): void {
    this.assistantStream.stop();
    this.client.abort();
    this.clearDraft("stopped");
  }
}

const runnerMap = new Map<string, ChatSessionRunner>();

export function getChatSessionRunner(chatId: string): ChatSessionRunner | null {
  if (!chatId) return null;
  if (!runnerMap.has(chatId)) runnerMap.set(chatId, new ChatSessionRunner(chatId));
  return runnerMap.get(chatId) || null;
}

export function stopChatSession(chatId: string): void {
  const runner = runnerMap.get(chatId);
  if (!runner) return;
  runner.stop();
}

export function removeChatSessionRunner(chatId: string): void {
  const runner = runnerMap.get(chatId);
  if (runner) runner.stop();
  runnerMap.delete(chatId);
}
