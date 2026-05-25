import { defaultModelCapabilities } from "@/constants";
import {
  buildDefaultChatSettings,
  createConversationModelSnapshot,
  getSnapshotEnabledCapabilities,
  getModelFromSnapshot,
  getSnapshotSupportedCapabilities,
  mergeChatSettingsWithModel,
  normalizeModelCapabilities,
} from "@/models";

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

function createInputCapabilities(conversation = null) {
  const supported = getSnapshotSupportedCapabilities(conversation?.modelSnapshot) || defaultModelCapabilities;
  const enabled = getSnapshotEnabledCapabilities(conversation?.modelSnapshot) || defaultModelCapabilities;
  const capabilities = normalizeModelCapabilities(enabled, supported);
  return capabilities;
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
  chatList: [],

  /**
   * 当前对话绑定的模型快照。会话创建后不再允许切换模型。
   */
  curConversation: null,

  /**
   * 单次输入启用的能力开关。最终能力还会被模型支持能力和配置启用能力约束。
   */
  inputCapabilities: createInputCapabilities(null),

  /**
   * 配置聊天模型的设置参数。
   */
  curChatModelSettings: buildDefaultChatSettings(null),

  /**
   * 当前激活会话的消息投影。
   */
  messages: [],

  /**
   * 本次前端会话内累计 token。仅保存在内存中，不持久化。
   */
  sessionTokenTotal: 0,
  sessionTokenUsage: emptyTokenUsage(),

  /**
   * 当前请求是否还在等待模型开始返回。仅用于实时 UI。
   */
  llmRequestPending: false,

  /**
   * 所有会话的运行态和本地缓存。
   */
  chatConversationsById: {},
  chatMessagesById: {},
  chatSettingsById: {},
  chatInputCapabilitiesById: {},
  chatRuntimeById: {},
  chatLoadedById: {},

  _ensureChatEntry(cid) {
    if (!cid) return;
    if (!this.chatMessagesById[cid]) this.chatMessagesById[cid] = [];
    if (!this.chatRuntimeById[cid]) this.chatRuntimeById[cid] = createChatRuntime();
    if (!this.chatLoadedById[cid]) this.chatLoadedById[cid] = false;
    if (!this.chatConversationsById[cid]) this.chatConversationsById[cid] = null;
    if (!this.chatSettingsById[cid]) {
      const model = getModelFromSnapshot(this.chatConversationsById[cid]?.modelSnapshot) || this.curChatModel;
      this.chatSettingsById[cid] = buildDefaultChatSettings(model);
    }
    if (!this.chatInputCapabilitiesById[cid]) {
      this.chatInputCapabilitiesById[cid] = createInputCapabilities(this.chatConversationsById[cid]);
    }
  },

  _applyRuntime(runtime) {
    const normalized = cloneRuntime(runtime);
    this.llmRequestPending = Boolean(normalized.pending);
    this.sessionTokenUsage = normalized.sessionTokenUsage;
    this.sessionTokenTotal = normalized.sessionTokenUsage.total_tokens;
  },

  _syncActiveChatState() {
    const cid = this.curChatId;
    if (!cid) {
      this.curConversation = null;
      this.messages = [];
      this._applyRuntime(createChatRuntime());
      return;
    }

    this._ensureChatEntry(cid);
    if (this.chatRuntimeById[cid]?.completedNotice) {
      this.chatRuntimeById[cid] = cloneRuntime({
        ...this.chatRuntimeById[cid],
        completedNotice: false,
      });
    }
    const conversation = this.chatConversationsById[cid] || null;
    this.curConversation = conversation;

    const model = getModelFromSnapshot(conversation?.modelSnapshot);
    if (model) {
      this.curChatModel = model;
    }

    this.curChatModelSettings = mergeChatSettingsWithModel(model || this.curChatModel, this.chatSettingsById[cid] || {});
    this.chatSettingsById[cid] = this.curChatModelSettings;
    this.inputCapabilities = {
      ...(this.chatInputCapabilitiesById[cid] || createInputCapabilities(conversation)),
    };
    this.chatInputCapabilitiesById[cid] = { ...this.inputCapabilities };
    this.messages = this.chatMessagesById[cid] || [];
    this._applyRuntime(this.chatRuntimeById[cid]);
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
    const activeModel = getModelFromSnapshot(this.curConversation?.modelSnapshot) || this.curChatModel;
    const nextSettings = mergeChatSettingsWithModel(activeModel, data);
    this.curChatModelSettings = nextSettings;
    if (this.curChatId) {
      this._ensureChatEntry(this.curChatId);
      this.chatSettingsById[this.curChatId] = nextSettings;
    }
  },

  /**
   * 设置当前对话绑定的模型快照。
   */
  setCurConversation(data) {
    this.curConversation = data || null;
    if (this.curChatId) {
      this._ensureChatEntry(this.curChatId);
      this.chatConversationsById[this.curChatId] = data || null;
      if (!this.chatInputCapabilitiesById[this.curChatId]) {
        this.chatInputCapabilitiesById[this.curChatId] = createInputCapabilities(data);
      }
    }
    const model = getModelFromSnapshot(this.curConversation?.modelSnapshot);
    if (model) {
      this.curChatModel = model;
      this.curChatModelSettings = mergeChatSettingsWithModel(model, this.curChatModelSettings);
      if (this.curChatId) this.chatSettingsById[this.curChatId] = this.curChatModelSettings;
    }
    this.resetInputCapabilities();
    this._syncActiveChatState();
  },

  /**
   * 从模型配置创建当前对话快照。
   */
  setCurConversationFromModel(data) {
    const snapshot = createConversationModelSnapshot(data);
    if (!snapshot) {
      this.curConversation = null;
      return;
    }
    this.setCurConversation({
      id: this.curChatId || "",
      title: "",
      modelSnapshot: snapshot,
    });
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
      this.chatInputCapabilitiesById[cid] = { ...(data.inputCapabilities || createInputCapabilities(this.chatConversationsById[cid])) };
    } else if (!this.chatInputCapabilitiesById[cid]) {
      this.chatInputCapabilitiesById[cid] = createInputCapabilities(this.chatConversationsById[cid]);
    }

    if ("messages" in (data || {})) {
      this.chatMessagesById[cid] = [...(data.messages || [])];
      const currentRuntime = this.chatRuntimeById[cid] || createChatRuntime();
      if (!currentRuntime.pending && !currentRuntime.draftAssistantContent && !currentRuntime.draftReasoningContent) {
        currentRuntime.status = getRuntimeStatusByUsage(this.chatMessagesById[cid]);
      }
      currentRuntime.sessionTokenUsage = emptyTokenUsage();
      this.chatMessagesById[cid].forEach((message) => {
        if (!message?.token_usage) return;
        const usage = normalizeTokenUsage(message.token_usage);
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
      this.curConversation = null;
      this.messages = [];
      this._applyRuntime(createChatRuntime());
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
    const nextCapabilities = createInputCapabilities(this.curConversation);
    this.inputCapabilities = nextCapabilities;
    if (this.curChatId) {
      this._ensureChatEntry(this.curChatId);
      this.chatInputCapabilitiesById[this.curChatId] = { ...nextCapabilities };
    }
  },

  setLlmRequestPending(data) {
    if (this.curChatId) {
      this._ensureChatEntry(this.curChatId);
      this.chatRuntimeById[this.curChatId] = cloneRuntime({
        ...this.chatRuntimeById[this.curChatId],
        pending: Boolean(data),
      });
      this._applyRuntime(this.chatRuntimeById[this.curChatId]);
      return;
    }

    this.llmRequestPending = Boolean(data);
  },

  addSessionTokens(data) {
    const usage = normalizeTokenUsage(data);
    if (usage.total_tokens <= 0) return;

    if (this.curChatId) {
      this._ensureChatEntry(this.curChatId);
      const runtime = cloneRuntime(this.chatRuntimeById[this.curChatId]);
      runtime.sessionTokenUsage = {
        input_tokens: runtime.sessionTokenUsage.input_tokens + usage.input_tokens,
        output_tokens: runtime.sessionTokenUsage.output_tokens + usage.output_tokens,
        total_tokens: runtime.sessionTokenUsage.total_tokens + usage.total_tokens,
      };
      runtime.sessionTokenTotal = runtime.sessionTokenUsage.total_tokens;
      this.chatRuntimeById[this.curChatId] = runtime;
      this._applyRuntime(runtime);
      return;
    }

    this.sessionTokenUsage = {
      input_tokens: this.sessionTokenUsage.input_tokens + usage.input_tokens,
      output_tokens: this.sessionTokenUsage.output_tokens + usage.output_tokens,
      total_tokens: this.sessionTokenUsage.total_tokens + usage.total_tokens,
    };
    this.sessionTokenTotal = this.sessionTokenUsage.total_tokens;
  },

  recalculateSessionTokens() {
    if (this.curChatId) {
      this._ensureChatEntry(this.curChatId);
      const runtime = cloneRuntime(this.chatRuntimeById[this.curChatId]);
      runtime.sessionTokenUsage = emptyTokenUsage();
      runtime.sessionTokenTotal = 0;
      (this.chatMessagesById[this.curChatId] || []).forEach((message) => {
        if (!message?.token_usage) return;
        const usage = normalizeTokenUsage(message.token_usage);
        runtime.sessionTokenUsage = {
          input_tokens: runtime.sessionTokenUsage.input_tokens + usage.input_tokens,
          output_tokens: runtime.sessionTokenUsage.output_tokens + usage.output_tokens,
          total_tokens: runtime.sessionTokenUsage.total_tokens + usage.total_tokens,
        };
      });
      runtime.sessionTokenTotal = runtime.sessionTokenUsage.total_tokens;
      this.chatRuntimeById[this.curChatId] = runtime;
      this._applyRuntime(runtime);
      return;
    }

    this.sessionTokenUsage = emptyTokenUsage();
    this.sessionTokenTotal = 0;
    this.messages.forEach((message) => {
      if (message?.token_usage) this.addSessionTokens(message.token_usage);
    });
  },

  resetSessionTokens() {
    if (this.curChatId) {
      this._ensureChatEntry(this.curChatId);
      const runtime = cloneRuntime(this.chatRuntimeById[this.curChatId]);
      runtime.sessionTokenTotal = 0;
      runtime.sessionTokenUsage = emptyTokenUsage();
      this.chatRuntimeById[this.curChatId] = runtime;
      this._applyRuntime(runtime);
      return;
    }

    this.sessionTokenTotal = 0;
    this.sessionTokenUsage = emptyTokenUsage();
  },

  /**
   * 向对话数组末尾添加消息
   */
  pushMessages(msg) {
    if (this.curChatId) {
      this._ensureChatEntry(this.curChatId);
      this.chatMessagesById[this.curChatId].push(msg);
      this.messages = this.chatMessagesById[this.curChatId];
      if (msg?.token_usage) this.addSessionTokens(msg.token_usage);
      return;
    }

    this.messages.push(msg);
    if (msg?.token_usage) this.addSessionTokens(msg.token_usage);
  },

  pushChatMessage(data) {
    const cid = data?.cid;
    const msg = data?.msg;
    if (!cid || !msg) return;
    this._ensureChatEntry(cid);
    this.chatMessagesById[cid].push(msg);
    this.chatLoadedById[cid] = true;
    if (cid === this.curChatId) {
      this.messages = this.chatMessagesById[cid];
      if (msg?.token_usage) this.addSessionTokens(msg.token_usage);
    } else if (msg?.token_usage) {
      const runtime = cloneRuntime(this.chatRuntimeById[cid]);
      const usage = normalizeTokenUsage(msg.token_usage);
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

  /**
   * 删除某个特定位置的消息
   */
  spliceMessages(index) {
    if (this.curChatId) {
      this._ensureChatEntry(this.curChatId);
      this.chatMessagesById[this.curChatId].splice(index, 1);
      this.messages = this.chatMessagesById[this.curChatId];
      this.recalculateSessionTokens();
      return;
    }

    this.messages.splice(index, 1);
    this.recalculateSessionTokens();
  },

  /**
   * 重置消息
   */
  resetMessages() {
    if (this.curChatId) {
      this._ensureChatEntry(this.curChatId);
      this.chatMessagesById[this.curChatId] = [];
      this.messages = [];
      this.resetSessionTokens();
      this.setLlmRequestPending(false);
      return;
    }

    this.messages = [];
    this.resetSessionTokens();
    this.setLlmRequestPending(false);
  },

  setChatRuntime(data) {
    const cid = data?.cid;
    if (!cid) return;
    this._ensureChatEntry(cid);
    this.chatRuntimeById[cid] = cloneRuntime({
      ...this.chatRuntimeById[cid],
      ...(data.runtime || {}),
    });
    if (cid === this.curChatId) this._applyRuntime(this.chatRuntimeById[cid]);
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
    if (cid === this.curChatId) this._applyRuntime(this.chatRuntimeById[cid]);
  },
};
