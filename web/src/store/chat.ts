import {
  buildDefaultChatSettings,
  chatTurnCapabilityKeys,
  createConversationModelSnapshot,
  defaultModelCapabilities,
  getModelFromSnapshot,
  mergeChatSettingsWithModel,
  normalizeModelCapabilities,
} from "@/constants";

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
  inputCapabilities: {
    ...defaultModelCapabilities,
    textInput: true,
    reasoning: false,
  },

  /**
   * 配置聊天模型的设置参数。
   */
  curChatModelSettings: buildDefaultChatSettings(null),

  /**
   * 全部的对话信息
   * @type {PromptContent[]}
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
   * 设置对话的列表
   */
  resetChatList(data) {
    this.chatList = [...data];
  },

  /**
   * 设置当前对话模型参数
   */

  setCurChatModelSettings(data) {
    const model = getModelFromSnapshot(this.curConversation?.modelSnapshot) || this.curChatModel;
    this.curChatModelSettings = mergeChatSettingsWithModel(model, data);
  },

  /**
   * 设置当前对话绑定的模型快照。
   */
  setCurConversation(data) {
    this.curConversation = data || null;
    const model = getModelFromSnapshot(this.curConversation?.modelSnapshot);
    if (model) {
      this.curChatModel = model;
      this.curChatModelSettings = mergeChatSettingsWithModel(model, this.curChatModelSettings);
    }
    this.resetInputCapabilities();
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

  setInputCapability(data) {
    const key = data?.key;
    if (!key || !(key in this.inputCapabilities)) return;
    this.inputCapabilities[key] = Boolean(data.value);
  },

  resetInputCapabilities() {
    const supported = this.curConversation?.modelSnapshot?.supportedCapabilities || defaultModelCapabilities;
    const enabled = this.curConversation?.modelSnapshot?.enabledCapabilities || defaultModelCapabilities;
    this.inputCapabilities = normalizeModelCapabilities(enabled, supported);
    this.inputCapabilities.textInput = true;
    this.inputCapabilities.reasoning = false;
    chatTurnCapabilityKeys.forEach((key) => {
      this.inputCapabilities[key] = false;
    });
  },

  setLlmRequestPending(data) {
    this.llmRequestPending = Boolean(data);
  },

  addSessionTokens(data) {
    const usage = normalizeTokenUsage(data);
    if (usage.total_tokens <= 0) return;
    this.sessionTokenUsage = {
      input_tokens: this.sessionTokenUsage.input_tokens + usage.input_tokens,
      output_tokens: this.sessionTokenUsage.output_tokens + usage.output_tokens,
      total_tokens: this.sessionTokenUsage.total_tokens + usage.total_tokens,
    };
    this.sessionTokenTotal = this.sessionTokenUsage.total_tokens;
  },

  recalculateSessionTokens() {
    this.sessionTokenUsage = emptyTokenUsage();
    this.sessionTokenTotal = 0;
    this.messages.forEach((message) => {
      if (message?.token_usage) this.addSessionTokens(message.token_usage);
    });
  },

  resetSessionTokens() {
    this.sessionTokenTotal = 0;
    this.sessionTokenUsage = emptyTokenUsage();
  },

  /**
   * 向对话数组末尾添加消息
   */
  pushMessages(msg) {
    this.messages.push(msg);
    if (msg?.token_usage) this.addSessionTokens(msg.token_usage);
  },

  /**
   * 删除某个特定位置的消息
   */
  spliceMessages(index) {
    this.messages.splice(index, 1);
    this.recalculateSessionTokens();
  },

  /**
   * 重置消息
   */

  resetMessages() {
    this.messages = [];
    this.resetSessionTokens();
    this.setLlmRequestPending(false);
  },
};
