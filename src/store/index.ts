import { createStore } from "vuex";
import { ChatState } from "./chat";
import { UserState, WORKSPACE_ID } from "./user";
import { ImageState } from "./image";
import { ModalState } from "./modal";

const state = {
  ...UserState,
  ...ChatState,
  ...ImageState,
  ...ModalState,
};

const mutations = {
  /** @param {state} state */
  SET_USER_LOGIN_INFO(state, data) {
    state.setUserLoginInfo(data);
  },

  /** @param {state} state */
  SET_LOGIN_STATE(state, data) {
    state.setIsLoggedIn(data);
  },

  /** @param {state} state */
  SET_STORAGE_MODE(state, data) {
    state.setStorageMode(data);
  },

  /** @param {state} state */
  SET_MODELS(state, data) {
    state.setModels(data);
  },

  /** @param {state} state */
  SET_CUR_CHAT_MODEL(state, data) {
    state.setCurChatModel(data);
  },

  /** @param {state} state */
  SET_CHAT_INS_TEMPLATE_LIST(state, data) {
    state.setChatInsTemplateList(data);
  },

  /** @param {state} state */
  SET_CURRENT_CHAT_MODEL_SETTINGS(state, data) {
    state.setCurChatModelSettings(data);
  },

  /** @param {state} state */
  RESET_CHAT_LIST(state, data) {
    state.resetChatList(data);
  },

  SET_CHAT_LOADED(state, data) {
    state.setChatLoaded(data);
  },

  /** @param {state} state */
  SET_CURRENT_CHAT_ID(state, data) {
    state.setCurChatId(data);
    if (typeof state._syncActiveChatState === "function") state._syncActiveChatState();
  },

  SET_CURRENT_CONVERSATION(state, data) {
    state.setCurConversation(data);
  },

  SET_CURRENT_CONVERSATION_MODEL(state, data) {
    state.setCurConversationFromModel(data);
  },

  HYDRATE_CHAT_SESSION(state, data) {
    state.hydrateChatSession(data);
  },

  REMOVE_CHAT_SESSION(state, data) {
    state.removeChatSession(data);
  },

  SET_INPUT_CAPABILITY(state, data) {
    state.setInputCapability(data);
  },

  RESET_INPUT_CAPABILITIES(state) {
    state.resetInputCapabilities();
  },

  SET_LLM_REQUEST_PENDING(state, data) {
    state.setLlmRequestPending(data);
  },

  ADD_SESSION_TOKENS(state, data) {
    state.addSessionTokens(data);
  },

  RESET_SESSION_TOKENS(state) {
    state.resetSessionTokens();
  },

  /** @param {state} state */
  PUSH_MESSAGES(state, data) {
    state.pushMessages(data);
  },

  PUSH_CHAT_MESSAGE(state, data) {
    state.pushChatMessage(data);
  },

  REPLACE_CHAT_MESSAGES(state, data) {
    state.replaceChatMessages(data);
  },

  /** @param {state} state */
  SPLICE_MESSAGES(state, index) {
    state.spliceMessages(index);
  },

  /** @param {state} state */
  RESET_MESSAGES(state) {
    state.resetMessages();
  },

  SET_CHAT_RUNTIME(state, data) {
    state.setChatRuntime(data);
  },

  RESET_CHAT_RUNTIME(state, data) {
    state.resetChatRuntime(data);
  },

  /**
   * ImageState 的接口
   */

  /** @param {state} state */
  RESET_IMAGE_LIST(state, data) {
    state.resetImageList(data);
  },

  /** @param {state} state */
  PUSH_IMAGE(state, data) {
    state.pushImage(data);
  },

  /** @param {state} state */
  DELETE_IMAGE(state, data) {
    state.deleteImage(data);
  },

  /**
   * ModalState 的接口
   */

  /** @param {state} state */
  SET_MODAL_IMAGE(state, data) {
    state.setModalImage(data);
  },
};

const actions = {
  async login({ commit }, username, password = "", uid = "") {
    commit("SET_USER_LOGIN_INFO", { username: WORKSPACE_ID, password: "", uid: WORKSPACE_ID });
    commit("SET_LOGIN_STATE", true);
  },

  async setStorageMode({ commit }, data) {
    commit("SET_STORAGE_MODE", data);
  },

  /**
   * chatState 的接口
   */
  async setModels({ commit }, models) {
    commit("SET_MODELS", models);
  },

  async setCurChatModel({ commit }, model) {
    commit("SET_CUR_CHAT_MODEL", model);
  },

  async setChatInsTemplateList({ commit }, data) {
    commit("SET_CHAT_INS_TEMPLATE_LIST", data);
  },

  async setCurChatModelSettings({ commit }, data) {
    commit("SET_CURRENT_CHAT_MODEL_SETTINGS", data);
  },

  async resetChatList({ commit }, data) {
    commit("RESET_CHAT_LIST", data);
  },

  async setChatLoaded({ commit }, data) {
    commit("SET_CHAT_LOADED", data);
  },

  async setCurChatId({ commit }, data) {
    commit("SET_CURRENT_CHAT_ID", data);
  },

  async setCurConversation({ commit }, data) {
    commit("SET_CURRENT_CONVERSATION", data);
  },

  async setCurConversationModel({ commit }, data) {
    commit("SET_CURRENT_CONVERSATION_MODEL", data);
  },

  async hydrateChatSession({ commit }, data) {
    commit("HYDRATE_CHAT_SESSION", data);
  },

  async removeChatSession({ commit }, data) {
    commit("REMOVE_CHAT_SESSION", data);
  },

  async setInputCapability({ commit }, data) {
    commit("SET_INPUT_CAPABILITY", data);
  },

  async resetInputCapabilities({ commit }) {
    commit("RESET_INPUT_CAPABILITIES");
  },

  async setLlmRequestPending({ commit }, data) {
    commit("SET_LLM_REQUEST_PENDING", data);
  },

  async addSessionTokens({ commit }, data) {
    commit("ADD_SESSION_TOKENS", data);
  },

  async resetSessionTokens({ commit }) {
    commit("RESET_SESSION_TOKENS");
  },

  async pushMessages({ commit }, data) {
    commit("PUSH_MESSAGES", data);
  },

  async pushChatMessage({ commit }, data) {
    commit("PUSH_CHAT_MESSAGE", data);
  },

  async replaceChatMessages({ commit }, data) {
    commit("REPLACE_CHAT_MESSAGES", data);
  },

  async spliceMessages({ commit }, index) {
    commit("SPLICE_MESSAGES", index);
  },

  async resetMessages({ commit }) {
    commit("RESET_MESSAGES");
  },

  async setChatRuntime({ commit }, data) {
    commit("SET_CHAT_RUNTIME", data);
  },

  async resetChatRuntime({ commit }, data) {
    commit("RESET_CHAT_RUNTIME", data);
  },

  /**
   * ImageState 的接口
   */

  async resetImageList({ commit }, data) {
    commit("RESET_IMAGE_LIST", data);
  },

  async pushImage({ commit }, data) {
    commit("PUSH_IMAGE", data);
  },

  async deleteImage({ commit }, data) {
    commit("DELETE_IMAGE", data);
  },

  /**
   * ModalState 的接口
   */
  async setModalImage({ commit }, data) {
    commit("SET_MODAL_IMAGE", data);
  },
};

export default createStore({
  state,
  mutations,
  actions,
});
