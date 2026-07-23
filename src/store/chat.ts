import { defaultModelCapabilities } from "@/constants";
import { getModelFromSnapshot, mergeChatSettingsWithModel } from "@/models";
import type { ChatListItem, ChatModelSettings, ChatPromptMessage, ChatModelSnapshot, TokenUsage } from "@/types";

interface StoredChatConversationProjection {
  id: string;
  title: string;
  modelSnapshot: ChatModelSnapshot;
}

interface ChatRuntimeState {
  status: string;
  pending: boolean;
  completedNotice: boolean;
  sessionTokenTotal: number;
  sessionTokenUsage: TokenUsage;
  draftMessageId: string;
  draftAssistantContent: string;
  draftReasoningContent: string;
  lastError: string;
}

const emptyTokenUsage = () => ({
  input_tokens: 0,
  output_tokens: 0,
  total_tokens: 0,
});

function normalizeTokenUsage(data: Record<string, unknown> = {}) {
  const inputTokens = Number(data?.input_tokens ?? data?.prompt_tokens ?? data?.inputTokens ?? data?.promptTokens ?? 0);
  const outputTokens = Number(data?.output_tokens ?? data?.completion_tokens ?? data?.outputTokens ?? data?.completionTokens ?? 0);
  const totalTokens = Number(data?.total_tokens ?? data?.totalTokens ?? data?.total ?? inputTokens + outputTokens);

  return {
    input_tokens: Number.isFinite(inputTokens) ? inputTokens : 0,
    output_tokens: Number.isFinite(outputTokens) ? outputTokens : 0,
    total_tokens: Number.isFinite(totalTokens) ? totalTokens : 0,
  };
}

function getMessageUsage(message: any) {
  return message?.meta?.run?.result?.usage || null;
}

function createInputCapabilities() {
  return { ...defaultModelCapabilities };
}

function createChatRuntime() {
  return {
    status: "idle",
    pending: false,
    completedNotice: false,
    sessionTokenTotal: 0,
    sessionTokenUsage: emptyTokenUsage(),
    draftMessageId: "",
    draftAssistantContent: "",
    draftReasoningContent: "",
    lastError: "",
  };
}

function cloneRuntime(runtime: Record<string, unknown> = {}) {
  return {
    ...createChatRuntime(),
    ...runtime,
    sessionTokenUsage: normalizeTokenUsage((runtime?.sessionTokenUsage as Record<string, unknown>) || {}),
  };
}

function getRuntimeStatusByUsage(messages = []) {
  return messages.length > 0 ? "success" : "idle";
}

/**
 * 表示聊天信息存储的对象。
 */
export const ChatState = {
  /**
   * 对话路由列表
   */
  chatList: [] as ChatListItem[],

  /**
   * 单次输入启用的能力开关。最终能力还会被模型支持能力和配置启用能力约束。
   */
  inputCapabilities: createInputCapabilities(),

  /**
   * 配置聊天模型的设置参数。
   */
  curChatModelSettings: mergeChatSettingsWithModel(null, {}),

  /**
   * 所有会话的运行态和本地缓存。
   */
  chatConversationsById: {} as Record<string, StoredChatConversationProjection | null>,
  chatMessagesById: {} as Record<string, ChatPromptMessage[]>,
  chatSettingsById: {} as Record<string, ChatModelSettings>,
  chatInputCapabilitiesById: {} as Record<string, Record<string, boolean>>,
  chatRuntimeById: {} as Record<string, ChatRuntimeState>,
  chatLoadedById: {} as Record<string, boolean>,

  _ensureChatEntry(cid) {
    if (!cid) return;
    if (!this.chatMessagesById[cid]) this.chatMessagesById[cid] = [];
    if (!this.chatRuntimeById[cid]) this.chatRuntimeById[cid] = createChatRuntime();
    if (!this.chatLoadedById[cid]) this.chatLoadedById[cid] = false;
    if (!this.chatConversationsById[cid]) this.chatConversationsById[cid] = null;
    if (!this.chatSettingsById[cid]) {
      const model = getModelFromSnapshot(this.chatConversationsById[cid]?.modelSnapshot) || this.curChatModel;
      this.chatSettingsById[cid] = mergeChatSettingsWithModel(model, {});
    }
    if (!this.chatInputCapabilitiesById[cid]) {
      this.chatInputCapabilitiesById[cid] = createInputCapabilities();
    }
  },

  _syncActiveChatState() {
    const cid = this.curChatId;
    if (!cid) return;

    this._ensureChatEntry(cid);
    if (this.chatRuntimeById[cid]?.completedNotice) {
      this.chatRuntimeById[cid] = cloneRuntime({
        ...this.chatRuntimeById[cid],
        completedNotice: false,
      });
    }
    const conversation = this.chatConversationsById[cid] || null;

    const model = getModelFromSnapshot(conversation?.modelSnapshot);
    if (model) {
      this.curChatModel = model;
    }

    this.curChatModelSettings = mergeChatSettingsWithModel(model || this.curChatModel, this.chatSettingsById[cid] || {});
    this.chatSettingsById[cid] = this.curChatModelSettings;
    this.inputCapabilities = {
      ...(this.chatInputCapabilitiesById[cid] || createInputCapabilities()),
    };
    this.chatInputCapabilitiesById[cid] = { ...this.inputCapabilities };
  },

  /**
   * 设置对话的列表
   */
  resetChatList(data) {
    this.chatList = [...data];
  },

  setChatLoaded(data) {
    const cid = data?.cid;
    if (!cid) return;
    this._ensureChatEntry(cid);
    this.chatLoadedById[cid] = Boolean(data.loaded);
  },

  /**
   * 设置当前对话模型参数
   */
  setCurChatModelSettings(data) {
    const activeConversation = this.curChatId ? this.chatConversationsById[this.curChatId] : null;
    const activeModel = this.curChatModel || getModelFromSnapshot(activeConversation?.modelSnapshot);
    const nextSettings = mergeChatSettingsWithModel(activeModel, data);
    this.curChatModelSettings = nextSettings;
    if (this.curChatId) {
      this._ensureChatEntry(this.curChatId);
      this.chatSettingsById[this.curChatId] = nextSettings;
    }
  },

  hydrateChatSession(data) {
    const cid = data?.cid;
    if (!cid) return;
    this._ensureChatEntry(cid);

    if ("conversation" in (data || {})) {
      this.chatConversationsById[cid] = data.conversation || null;
    }

    if ("settings" in (data || {})) {
      const model = getModelFromSnapshot(this.chatConversationsById[cid]?.modelSnapshot) || this.curChatModel;
      this.chatSettingsById[cid] = mergeChatSettingsWithModel(model, data.settings || {});
    }

    if ("inputCapabilities" in (data || {})) {
      this.chatInputCapabilitiesById[cid] = { ...(data.inputCapabilities || createInputCapabilities()) };
    } else if (!this.chatInputCapabilitiesById[cid]) {
      this.chatInputCapabilitiesById[cid] = createInputCapabilities();
    }

    if ("messages" in (data || {})) {
      this.chatMessagesById[cid] = [...(data.messages || [])];
      const currentRuntime = this.chatRuntimeById[cid] || createChatRuntime();
      if (!currentRuntime.pending && !currentRuntime.draftAssistantContent && !currentRuntime.draftReasoningContent) {
        currentRuntime.status = getRuntimeStatusByUsage(this.chatMessagesById[cid]);
      }
      currentRuntime.sessionTokenUsage = emptyTokenUsage();
      this.chatMessagesById[cid].forEach((message) => {
        const messageUsage = getMessageUsage(message);
        if (!messageUsage) return;
        const usage = normalizeTokenUsage(messageUsage);
        currentRuntime.sessionTokenUsage = {
          input_tokens: currentRuntime.sessionTokenUsage.input_tokens + usage.input_tokens,
          output_tokens: currentRuntime.sessionTokenUsage.output_tokens + usage.output_tokens,
          total_tokens: currentRuntime.sessionTokenUsage.total_tokens + usage.total_tokens,
        };
      });
      currentRuntime.sessionTokenTotal = currentRuntime.sessionTokenUsage.total_tokens;
      this.chatRuntimeById[cid] = currentRuntime;
    }

    if ("runtime" in (data || {})) {
      this.chatRuntimeById[cid] = cloneRuntime({
        ...(this.chatRuntimeById[cid] || {}),
        ...(data.runtime || {}),
      });
    }

    if ("loaded" in (data || {})) {
      this.chatLoadedById[cid] = Boolean(data.loaded);
    }

    if (cid === this.curChatId) this._syncActiveChatState();
  },

  removeChatSession(cid) {
    if (!cid) return;
    delete this.chatConversationsById[cid];
    delete this.chatMessagesById[cid];
    delete this.chatSettingsById[cid];
    delete this.chatInputCapabilitiesById[cid];
    delete this.chatRuntimeById[cid];
    delete this.chatLoadedById[cid];

    if (cid === this.curChatId) {
      this.inputCapabilities = createInputCapabilities();
    }
  },

  setInputCapability(data) {
    const key = data?.key;
    if (!key || !(key in this.inputCapabilities)) return;

    if (this.curChatId) {
      this._ensureChatEntry(this.curChatId);
      this.chatInputCapabilitiesById[this.curChatId][key] = Boolean(data.value);
      this.inputCapabilities = { ...this.chatInputCapabilitiesById[this.curChatId] };
      return;
    }

    this.inputCapabilities[key] = Boolean(data.value);
  },

  resetInputCapabilities() {
    const nextCapabilities = createInputCapabilities();
    this.inputCapabilities = nextCapabilities;
    if (this.curChatId) {
      this._ensureChatEntry(this.curChatId);
      this.chatInputCapabilitiesById[this.curChatId] = { ...nextCapabilities };
    }
  },

  pushChatMessage(data) {
    const cid = data?.cid;
    const msg = data?.msg;
    if (!cid || !msg) return;
    this._ensureChatEntry(cid);
    this.chatMessagesById[cid].push(msg);
    this.chatLoadedById[cid] = true;
    if (getMessageUsage(msg)) {
      const runtime = cloneRuntime(this.chatRuntimeById[cid]);
      const usage = normalizeTokenUsage(getMessageUsage(msg));
      runtime.sessionTokenUsage = {
        input_tokens: runtime.sessionTokenUsage.input_tokens + usage.input_tokens,
        output_tokens: runtime.sessionTokenUsage.output_tokens + usage.output_tokens,
        total_tokens: runtime.sessionTokenUsage.total_tokens + usage.total_tokens,
      };
      runtime.sessionTokenTotal = runtime.sessionTokenUsage.total_tokens;
      this.chatRuntimeById[cid] = runtime;
    }
  },

  replaceChatMessages(data) {
    const cid = data?.cid;
    if (!cid) return;
    this._ensureChatEntry(cid);
    this.chatMessagesById[cid] = [...(data.messages || [])];
    this.chatLoadedById[cid] = true;
    this.hydrateChatSession({ cid, messages: this.chatMessagesById[cid], loaded: true });
  },

  setChatRuntime(data) {
    const cid = data?.cid;
    if (!cid) return;
    this._ensureChatEntry(cid);
    this.chatRuntimeById[cid] = cloneRuntime({
      ...this.chatRuntimeById[cid],
      ...(data.runtime || {}),
    });
  },

  resetChatRuntime(data) {
    const cid = typeof data === "string" ? data : data?.cid;
    if (!cid) return;
    this._ensureChatEntry(cid);
    const nextStatus = getRuntimeStatusByUsage(this.chatMessagesById[cid] || []);
    this.chatRuntimeById[cid] = {
      ...createChatRuntime(),
      status: nextStatus,
    };
  },
};
