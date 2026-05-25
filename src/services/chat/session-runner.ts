import store from "@/store";
import { getModelFromSnapshot } from "@/models";
import { getUuid } from "@/utils";
import { tr } from "@/i18n";
import type { ChatPromptMessage, ChatProviderResponse, TokenUsage } from "@/services/chat/types";

import { addMessage } from "./conversation";
import { ChatProxy } from "./chat-proxy";

class ChatSessionRunner {
  chatId: string;
  client: ChatProxy;
  forceStop: boolean;
  tmpAssErrorFlag: boolean;
  tmpAssContentData: { content: string; reasoning_content: string };
  tmpAssTokenUsage: TokenUsage | null;
  tmpAssContentMid: string;
  lastError: string;

  constructor(chatId: string) {
    this.chatId = chatId;
    this.client = new ChatProxy();
    this.forceStop = false;
    this.tmpAssErrorFlag = false;
    this.tmpAssContentData = { content: "", reasoning_content: "" };
    this.tmpAssTokenUsage = null;
    this.tmpAssContentMid = "";
    this.lastError = "";

    this.enqueueRender = this.enqueueRender.bind(this);
  }

  getSessionContext() {
    return {
      conversation: store.state.chatConversationsById?.[this.chatId] || null,
      settings: store.state.chatSettingsById?.[this.chatId] || store.state.curChatModelSettings,
      model:
        getModelFromSnapshot(store.state.chatConversationsById?.[this.chatId]?.modelSnapshot) ||
        store.state.curChatModel ||
        store.state.models.chat?.[0] ||
        null,
    };
  }

  updateRuntime(runtime = {}) {
    store.dispatch("setChatRuntime", {
      cid: this.chatId,
      runtime,
    });
  }

  clearDraft(status = "idle", extra = {}) {
    const isBackgroundComplete = ["success", "error", "stopped"].includes(status) && store.state.curChatId !== this.chatId;
    this.updateRuntime({
      status,
      pending: false,
      completedNotice: isBackgroundComplete,
      draftMessageId: "",
      draftAssistantContent: "",
      draftReasoningContent: "",
      ...extra,
    });
  }

  async persistAssistantMessage() {
    if (!this.tmpAssContentData.content && !this.tmpAssContentData.reasoning_content) return false;

    const assistantData: ChatPromptMessage = {
      role: "assistant",
      content: [{ type: "text", text: this.tmpAssContentData.content }],
      reasoning_content: this.tmpAssContentData.reasoning_content,
    };
    if (this.tmpAssTokenUsage) assistantData.token_usage = this.tmpAssTokenUsage;

    await store.dispatch("pushChatMessage", {
      cid: this.chatId,
      msg: {
        ...assistantData,
        mid: this.tmpAssContentMid,
      },
    });
    await addMessage(this.chatId, this.tmpAssContentMid, assistantData);
    return true;
  }

  enqueueRender(response: ChatProviderResponse): void {
    if (this.forceStop) return;

    if (response?.usage) {
      this.tmpAssTokenUsage = response.usage;
    }

    if (response.flag === false) {
      this.tmpAssErrorFlag = true;
      this.lastError = String(response.content || "");
      this.updateRuntime({
        status: "error",
        pending: false,
        draftMessageId: this.tmpAssContentMid,
        draftAssistantContent: this.tmpAssContentData.content,
        draftReasoningContent: this.tmpAssContentData.reasoning_content,
        lastError: this.lastError,
      });
      return;
    }

    this.tmpAssContentData.content += response?.content || "";
    this.tmpAssContentData.reasoning_content += response?.reasoning_content || "";

    this.updateRuntime({
      status: "streaming",
      pending: false,
      draftMessageId: this.tmpAssContentMid,
      draftAssistantContent: this.tmpAssContentData.content,
      draftReasoningContent: this.tmpAssContentData.reasoning_content,
      lastError: "",
    });
  }

  async chat(data: ChatPromptMessage): Promise<void> {
    this.forceStop = false;
    this.tmpAssErrorFlag = false;
    this.tmpAssContentData = { content: "", reasoning_content: "" };
    this.tmpAssTokenUsage = null;
    this.lastError = "";
    this.tmpAssContentMid = getUuid("msg");

    const context = this.getSessionContext();
    const chatData = { ...data, mid: getUuid("msg") };

    await store.dispatch("pushChatMessage", {
      cid: this.chatId,
      msg: chatData,
    });
    await addMessage(this.chatId, chatData.mid, data);

    const history = store.state.chatMessagesById?.[this.chatId] || [];
    const passedMsgLen = Number(context.settings?.passedMsgLen || history.length || 1);
    const messages = history.slice(-Math.min(passedMsgLen, history.length));

    this.updateRuntime({
      status: "loading",
      pending: true,
      draftMessageId: this.tmpAssContentMid,
      draftAssistantContent: "",
      draftReasoningContent: "",
      lastError: "",
    });

    this.client.init(context);
    const flag = await this.client.chat(messages, context, this.enqueueRender);

    if (this.forceStop) {
      this.clearDraft("stopped");
      return;
    }

    const hasAssistantContent = Boolean(this.tmpAssContentData.content || this.tmpAssContentData.reasoning_content);

    if (this.tmpAssErrorFlag) {
      if (hasAssistantContent) {
        await this.persistAssistantMessage();
      }
      this.clearDraft("error", { lastError: this.lastError || tr("toast.modelRequestFailed", { error: "" }) });
      return;
    }

    if (!flag) {
      this.clearDraft("error");
      return;
    }

    if (!this.tmpAssContentData.content) {
      this.tmpAssContentData.content = tr("chat.timeoutNoContent");
    }

    await this.persistAssistantMessage();
    this.clearDraft("success");
  }

  stop(): void {
    this.forceStop = true;
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
