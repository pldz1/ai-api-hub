import { normalizeChatModelConfig, sanitizeModelSettings } from "@/models";

export const WORKSPACE_ID = "__workspace__";
export const WORKSPACE_LABEL = "Workspace";

type UserLoginPayload = {
  username?: string;
  password?: string;
  uid?: string;
};

export const UserState = {
  /**
   * Fixed local workspace identifier.
   */
  username: WORKSPACE_ID,

  /**
   * Legacy field kept for store compatibility.
   */
  password: "",

  /**
   * Fixed local workspace uid.
   */
  uid: WORKSPACE_ID,

  /**
   * Legacy field kept for store compatibility.
   */
  basicAuth: "",

  /**
   * Single-workspace mode is always logged in.
   */
  isLoggedIn: true,

  /**
   * All configured models.
   */
  models: { chat: [], image: [] },

  /**
   * Currently selected chat model.
   */
  curChatModel: null,

  /**
   * Available chat instruction templates.
   */
  chatInsTemplateList: [],

  /**
   * Current chat id.
   */
  curChatId: "",

  /**
   * Set current workspace identity.
   */
  setUserLoginInfo(_data: UserLoginPayload) {
    this.username = WORKSPACE_ID;
    this.password = "";
    this.uid = WORKSPACE_ID;
    this.basicAuth = "";
  },

  /**
   * Single-workspace mode stays logged in.
   */
  setIsLoggedIn(_data: boolean) {
    this.isLoggedIn = true;
  },

  /**
   * Set all configured models.
   */
  setModels(data: unknown) {
    this.models = sanitizeModelSettings(data);
  },

  /**
   * Set chat instruction templates.
   */
  setChatInsTemplateList(data: unknown[]) {
    this.chatInsTemplateList = data;
  },

  /**
   * Set current chat model info.
   */
  setCurChatModel(data: unknown) {
    this.curChatModel = data ? normalizeChatModelConfig(data) : null;
  },

  /**
   * Set current chat id.
   */
  setCurChatId(data: string) {
    this.curChatId = data;
  },
};
