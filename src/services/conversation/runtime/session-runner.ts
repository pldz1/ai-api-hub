import store from "@/store";
import { ChatGateway, resolveChatModel } from "@/ai-capability";
import { buildChatCompletionParams, completeRunSnapshot, createRunSnapshot, getChatMessageFormat, getModelFromSnapshot } from "@/models";
import { getUuid } from "@/utils";
import { tr } from "@/i18n";
import type { ChatModelConfig, ChatPromptContent, ChatPromptMessage, ChatResponseDelta, RunSnapshot, RunStatus, PackedChatMessage } from "@/types";
import { addMessage } from "../conversation";
import { composeChatPromptText } from "../chat-files";
import { createStreamState, type StreamState, type StreamDraft } from "../rendering/stream-state";

type ChatRuntimeStatus = "idle" | "loading" | "streaming" | "success" | "error" | "stopped";

// ===== helpers =====

function getSessionModel(chatId: string): ChatModelConfig | null {
  return getModelFromSnapshot(store.state.chatConversationsById?.[chatId]?.modelSnapshot) || store.state.curChatModel || store.state.models.chat?.[0] || null;
}

export function packChatMessages(messages: ChatPromptMessage[], chatId: string, model: ChatModelConfig | null): PackedChatMessage[] {
  const settings = store.state.chatSettingsById?.[chatId] || store.state.curChatModelSettings;
  const firstPromptContent = settings?.prompts?.[0]?.content?.[0];
  const hasSystemPrompt = firstPromptContent?.type === "text" && Boolean(firstPromptContent.text);
  const combinedMessages = hasSystemPrompt ? [...settings.prompts, ...messages] : messages;

  if (getChatMessageFormat(model) === "text") {
    return combinedMessages.map((entry) => ({
      role: entry.role,
      content:
        entry.role === "user" && entry.attachments?.length
          ? composeChatPromptText(entry.content[0]?.type === "text" ? entry.content[0].text : "", entry.attachments)
          : entry.content[0]?.type === "text"
            ? entry.content[0].text
            : "",
    }));
  }

  return combinedMessages.map((entry) => ({
    role: entry.role,
    content:
      entry.role === "user" && entry.attachments?.length
        ? [
            {
              type: "text",
              text: composeChatPromptText(entry.content[0]?.type === "text" ? entry.content[0].text : "", entry.attachments),
            },
            ...(entry.content as ChatPromptContent[]).filter((part) => part.type === "image_url"),
          ]
        : (entry.content as ChatPromptContent[]),
  }));
}

// ===== runner factory =====

export interface ChatRunner {
  chat(data: ChatPromptMessage): Promise<void>;
  regenerate(): Promise<void>;
  stop(): void;
  getStream(): StreamState;
  readonly chatId: string;
  onDraftUpdate: ((draft: StreamDraft) => void) | null;
  onDraftRemove: (() => void) | null;
  onMessagePersisted: ((msg: ChatPromptMessage) => void | Promise<void>) | null;
  onRuntimeUpdate: ((runtime: Record<string, unknown>) => void) | null;
}

function createChatRunner(chatId: string): ChatRunner {
  const stream = createStreamState();
  const client = new ChatGateway();

  let _onDraftUpdate: ((draft: StreamDraft) => void) | null = null;
  let _onDraftRemove: (() => void) | null = null;
  let _onMessagePersisted: ((msg: ChatPromptMessage) => void | Promise<void>) | null = null;
  let _onRuntimeUpdate: ((runtime: Record<string, unknown>) => void) | null = null;
  let activeRun: RunSnapshot | null = null;

  // === runtime sync ===

  function updateRuntime(runtime: Record<string, unknown> = {}) {
    store.commit("setChatRuntime", { cid: chatId, runtime });
    _onRuntimeUpdate?.(runtime);
  }

  function clearDraft(status: ChatRuntimeStatus = "idle", extra: Record<string, unknown> = {}) {
    const completedInBackground = ["success", "error", "stopped"].includes(status) && store.state.curChatId !== chatId;
    updateRuntime({
      status,
      pending: false,
      completedNotice: completedInBackground,
      draftMessageId: "",
      draftAssistantContent: "",
      draftReasoningContent: "",
      ...extra,
    });
    _onDraftRemove?.();
  }

  function completeRun(status: Exclude<RunStatus, "running">, error = ""): RunSnapshot | undefined {
    if (!activeRun) return undefined;
    return completeRunSnapshot(activeRun, {
      status,
      usage: stream.getTokenUsage(),
      outputCount: stream.hasContent() ? 1 : 0,
      error,
    });
  }

  async function persistAssistant(status: "success" | "error"): Promise<boolean> {
    if (!stream.hasContent()) return false;

    const draft = stream.getDraft();
    const run = completeRun(status, status === "error" ? stream.getError() : "");
    const assistantMsg: ChatPromptMessage = {
      role: "assistant",
      content: [{ type: "text", text: draft.content }],
      reasoning_content: draft.reasoning_content,
      mid: stream.getMessageId(),
      meta: {
        isContextBlocked: stream.isError() || undefined,
        run,
      },
    };
    store.commit("pushChatMessage", { cid: chatId, msg: assistantMsg });
    await addMessage(chatId, stream.getMessageId(), assistantMsg);
    await _onMessagePersisted?.(assistantMsg);
    return true;
  }

  function enqueueDelta(delta: ChatResponseDelta) {
    if (stream.isStopped()) return;

    stream.applyDelta(delta);
    const draft = stream.getDraft();
    updateRuntime({
      status: delta.kind === "error" ? "error" : "streaming",
      pending: delta.kind !== "error",
      draftMessageId: stream.getMessageId(),
      draftAssistantContent: draft.content,
      draftReasoningContent: draft.reasoning_content,
    });
    _onDraftUpdate?.(draft);

    if (delta.kind === "error") {
      updateRuntime({
        status: "error",
        pending: false,
        draftMessageId: stream.getMessageId(),
        draftAssistantContent: stream.getDraft().content,
        draftReasoningContent: stream.getDraft().reasoning_content,
        lastError: stream.getError(),
      });
    }
  }

  // === phase 1: prepare — reset stream, persist user message, set loading ===

  async function prepareRequest(data: ChatPromptMessage): Promise<void> {
    activeRun = null;
    stream.startStream(getUuid("msg"));

    const userMessage = { ...data, mid: getUuid("msg") };
    store.commit("pushChatMessage", { cid: chatId, msg: userMessage });
    await addMessage(chatId, userMessage.mid, userMessage);
    await _onMessagePersisted?.(userMessage);

    updateRuntime({
      status: "loading",
      pending: true,
      draftMessageId: stream.getMessageId(),
      draftAssistantContent: "",
      draftReasoningContent: "",
      lastError: "",
    });
  }

  function prepareRegeneration(): void {
    activeRun = null;
    const history = store.state.chatMessagesById?.[chatId] || [];
    if (history.at(-1)?.role !== "user") throw new Error("Chat regeneration requires a user message at the end of the conversation.");
    stream.startStream(getUuid("msg"));
    updateRuntime({
      status: "loading",
      pending: true,
      draftMessageId: stream.getMessageId(),
      draftAssistantContent: "",
      draftReasoningContent: "",
      lastError: "",
    });
  }

  // === phase 2: execute — build request, call gateway, iterate stream ===

  async function executeStream(): Promise<boolean> {
    const startedAt = Date.now();
    const model = getSessionModel(chatId);
    const settings = store.state.chatSettingsById?.[chatId] || store.state.curChatModelSettings;

    const history = (store.state.chatMessagesById?.[chatId] || []).filter((msg) => !msg.meta?.isContextBlocked);
    const passedMsgLen = Number(settings?.passedMsgLen || history.length || 1);
    const messages = history.slice(-Math.min(passedMsgLen, history.length));
    const packedMessages = packChatMessages(messages, chatId, model);
    const params = buildChatCompletionParams(model, settings);
    const capabilities = messages[messages.length - 1]?.meta?.usedCapabilities || {};
    const resolvedModel = model ? resolveChatModel(model) : null;
    if (resolvedModel) {
      activeRun = createRunSnapshot({
        kind: "chat",
        startedAt,
        route: {
          knownModel: resolvedModel.knownModel,
          bindingKey: resolvedModel.binding.key,
          provider: resolvedModel.config.provider,
          model: resolvedModel.config.model,
          adapterId: resolvedModel.binding.adapterId,
          connectionURL: resolvedModel.config.baseURL,
        },
        params,
        capabilities: {
          imageRead: Boolean(capabilities.imageRead),
          webSearch: Boolean(capabilities.webSearch),
        },
        inputCount: packedMessages.length,
      });
    }
    const request = {
      model,
      params,
      capabilities,
    };

    const gen = client.chat(packedMessages, request);

    let next = await gen.next();
    while (!next.done) {
      enqueueDelta(next.value as ChatResponseDelta);
      next = await gen.next();
    }
    return Boolean(next.value);
  }

  // === phase 3: finalize — handle outcome, persist, clean up ===

  async function finalizeStream(completed: boolean): Promise<void> {
    if (stream.isStopped()) {
      clearDraft("stopped");
      return;
    }

    if (stream.isError()) {
      if (!stream.hasContent()) {
        stream.setContent(stream.getError() || tr("toast.modelRequestFailed", { error: "" }));
      }
      await persistAssistant("error");
      clearDraft("error", { lastError: stream.getError() || tr("toast.modelRequestFailed", { error: "" }) });
      return;
    }

    if (!completed) {
      clearDraft("error");
      return;
    }

    if (!stream.getDraft().content) {
      stream.setContent(tr("chat.timeoutNoContent"));
    }

    stream.complete();
    await persistAssistant("success");
    clearDraft("success");
  }

  // === public API ===

  async function chat(data: ChatPromptMessage): Promise<void> {
    await prepareRequest(data);
    const completed = await executeStream();
    await finalizeStream(completed);
  }

  async function regenerate(): Promise<void> {
    prepareRegeneration();
    const completed = await executeStream();
    await finalizeStream(completed);
  }

  function stop() {
    stream.stop();
    client.abort();
    clearDraft("stopped");
  }

  return {
    chat,
    regenerate,
    stop,
    getStream: () => stream,
    get chatId() {
      return chatId;
    },
    set onDraftUpdate(v) {
      _onDraftUpdate = v;
    },
    set onDraftRemove(v) {
      _onDraftRemove = v;
    },
    set onMessagePersisted(v) {
      _onMessagePersisted = v;
    },
    set onRuntimeUpdate(v) {
      _onRuntimeUpdate = v;
    },
    get onDraftUpdate() {
      return _onDraftUpdate;
    },
    get onDraftRemove() {
      return _onDraftRemove;
    },
    get onMessagePersisted() {
      return _onMessagePersisted;
    },
    get onRuntimeUpdate() {
      return _onRuntimeUpdate;
    },
  };
}

// ===== runner registry =====

const runnerMap = new Map<string, ChatRunner>();

export function getChatSessionRunner(chatId: string): ChatRunner | null {
  if (!chatId) return null;
  if (!runnerMap.has(chatId)) runnerMap.set(chatId, createChatRunner(chatId));
  return runnerMap.get(chatId) || null;
}

export function stopChatSession(chatId: string): void {
  runnerMap.get(chatId)?.stop();
}

export function removeChatSessionRunner(chatId: string): void {
  const runner = runnerMap.get(chatId);
  if (runner) runner.stop();
  runnerMap.delete(chatId);
}
