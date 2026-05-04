import { defModelType, getModelChatParamDefs, getModelImageParamDefs } from "@/constants";

const USER_SESSION_KEY = "ai.api.hub.workspace-session.v1";
export const WORKSPACE_ID = "__workspace__";
export const WORKSPACE_LABEL = "Workspace";

function readUserSession() {
  try {
    const raw = localStorage.getItem(USER_SESSION_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.warn("Failed to read workspace session:", error);
    return {};
  }
}

function writeUserSession(state) {
  try {
    const payload = {
      hostUrl: state.hostUrl || "",
      storageMode: state.storageMode || "unknown",
    };
    localStorage.setItem(USER_SESSION_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn("Failed to persist workspace session:", error);
  }
}

const persistedUserSession = readUserSession();

export const UserState = {
  /**
   * 固定工作区标识
   * @type {string}
   */
  username: WORKSPACE_ID,

  /**
   * 兼容旧状态结构保留的字段
   * @type {string}
   */
  password: "",

  /**
   * 固定工作区 uid
   * @type {string}
   */
  uid: WORKSPACE_ID,

  /**
   * 简单的base64加密的认证字符
   * @type {string}
   */
  basicAuth: "",

  /**
   * 单工作区模式下始终为 true
   * @type {boolean}
   */
  isLoggedIn: true,

  /**
   * 全部模型
   * @property {any[]} chat 对话模型列表
   * @property {any[]} image 图像模型列表
   * @property {any[]} rtaduio 实时语音模型列表
   */
  models: { chat: [], image: [], rtaudio: [] },

  /**
   * 当前的对话模型信息
   */
  curChatModel: structuredClone(defModelType),

  /**
   * 当前工作区有的对话指令
   */
  chatInsTemplateList: [],

  /**
   * 当前的对话id
   */
  curChatId: "",

  /**
   * 网页接口的server的host
   */
  hostUrl: persistedUserSession.hostUrl || "",

  /**
   * 当前存储模式: server / browser / unknown
   */
  storageMode: persistedUserSession.storageMode || persistedUserSession.backendMode || "unknown",

  /**
   * 设置当前工作区信息
   */
  setUserLoginInfo(data) {
    this.username = WORKSPACE_ID;
    this.password = "";
    this.uid = WORKSPACE_ID;
    this.basicAuth = "";
    writeUserSession(this);
  },

  /**
   * 设置当前工作区就绪状态
   */
  setIsLoggedIn(data) {
    this.isLoggedIn = true;
    writeUserSession(this);
  },

  /**
   * 设置全部模型
   */
  setModels(data) {
    const normalizeModels = (items = [], kind = "") =>
      items.map((item) => ({
        ...structuredClone(defModelType),
        ...item,
        chatParamDefs: kind === "chat" ? getModelChatParamDefs(item) : Array.isArray(item?.chatParamDefs) ? item.chatParamDefs : [],
        imageParamDefs: kind === "image" ? getModelImageParamDefs(item) : Array.isArray(item?.imageParamDefs) ? item.imageParamDefs : [],
      }));

    this.models = {
      chat: normalizeModels(data?.chat, "chat"),
      image: normalizeModels(data?.image, "image"),
      rtaudio: normalizeModels(data?.rtaudio),
    };
  },

  /**
   * 设置对话指令列表
   */
  setChatInsTemplateList(data) {
    this.chatInsTemplateList = data;
  },

  /**
   * 设置当前对话模型的信息
   */
  setCurChatModel(data) {
    this.curChatModel = {
      ...structuredClone(defModelType),
      ...(data || {}),
      chatParamDefs: getModelChatParamDefs(data),
    };
  },

  /**
   * 设置当前对话
   */

  setCurChatId(data) {
    this.curChatId = data;
  },

  /**
   * 设置网页请求的host url.
   */

  setHostUrl(data) {
    this.hostUrl = data;
    writeUserSession(this);
  },

  /**
   * 设置当前存储模式
   */
  setStorageMode(data) {
    this.storageMode = data || "unknown";
    writeUserSession(this);
  },
};
