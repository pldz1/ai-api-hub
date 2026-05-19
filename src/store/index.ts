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

function createStateMutation(methodName, afterMutate = null) {
  return (storeState, payload) => {
    if (typeof storeState[methodName] === "function") {
      storeState[methodName](payload);
    }
    if (typeof afterMutate === "function") {
      afterMutate(storeState, payload);
    }
  };
}

const mutations = {
  SET_USER_LOGIN_INFO: createStateMutation("setUserLoginInfo"),
  SET_LOGIN_STATE: createStateMutation("setIsLoggedIn"),
  SET_MODELS: createStateMutation("setModels"),
  SET_CUR_CHAT_MODEL: createStateMutation("setCurChatModel"),
  SET_CHAT_INS_TEMPLATE_LIST: createStateMutation("setChatInsTemplateList"),
  SET_CURRENT_CHAT_MODEL_SETTINGS: createStateMutation("setCurChatModelSettings"),
  RESET_CHAT_LIST: createStateMutation("resetChatList"),
  SET_CHAT_LOADED: createStateMutation("setChatLoaded"),
  SET_CURRENT_CHAT_ID: createStateMutation("setCurChatId", (storeState) => {
    if (typeof storeState._syncActiveChatState === "function") {
      storeState._syncActiveChatState();
    }
  }),
  SET_CURRENT_CONVERSATION: createStateMutation("setCurConversation"),
  SET_CURRENT_CONVERSATION_MODEL: createStateMutation("setCurConversationFromModel"),
  HYDRATE_CHAT_SESSION: createStateMutation("hydrateChatSession"),
  REMOVE_CHAT_SESSION: createStateMutation("removeChatSession"),
  SET_INPUT_CAPABILITY: createStateMutation("setInputCapability"),
  RESET_INPUT_CAPABILITIES: createStateMutation("resetInputCapabilities"),
  SET_LLM_REQUEST_PENDING: createStateMutation("setLlmRequestPending"),
  ADD_SESSION_TOKENS: createStateMutation("addSessionTokens"),
  RESET_SESSION_TOKENS: createStateMutation("resetSessionTokens"),
  PUSH_MESSAGES: createStateMutation("pushMessages"),
  PUSH_CHAT_MESSAGE: createStateMutation("pushChatMessage"),
  REPLACE_CHAT_MESSAGES: createStateMutation("replaceChatMessages"),
  SPLICE_MESSAGES: createStateMutation("spliceMessages"),
  RESET_MESSAGES: createStateMutation("resetMessages"),
  SET_CHAT_RUNTIME: createStateMutation("setChatRuntime"),
  RESET_CHAT_RUNTIME: createStateMutation("resetChatRuntime"),
  RESET_IMAGE_LIST: createStateMutation("resetImageList"),
  PUSH_IMAGE: createStateMutation("pushImage"),
  DELETE_IMAGE: createStateMutation("deleteImage"),
  SET_MODAL_IMAGE: createStateMutation("setModalImage"),
};

function createCommitAction(type) {
  return ({ commit }, payload) => commit(type, payload);
}

const passthroughActions = {
  setModels: "SET_MODELS",
  setCurChatModel: "SET_CUR_CHAT_MODEL",
  setChatInsTemplateList: "SET_CHAT_INS_TEMPLATE_LIST",
  setCurChatModelSettings: "SET_CURRENT_CHAT_MODEL_SETTINGS",
  resetChatList: "RESET_CHAT_LIST",
  setChatLoaded: "SET_CHAT_LOADED",
  setCurChatId: "SET_CURRENT_CHAT_ID",
  setCurConversation: "SET_CURRENT_CONVERSATION",
  setCurConversationModel: "SET_CURRENT_CONVERSATION_MODEL",
  hydrateChatSession: "HYDRATE_CHAT_SESSION",
  removeChatSession: "REMOVE_CHAT_SESSION",
  setInputCapability: "SET_INPUT_CAPABILITY",
  resetInputCapabilities: "RESET_INPUT_CAPABILITIES",
  setLlmRequestPending: "SET_LLM_REQUEST_PENDING",
  addSessionTokens: "ADD_SESSION_TOKENS",
  resetSessionTokens: "RESET_SESSION_TOKENS",
  pushMessages: "PUSH_MESSAGES",
  pushChatMessage: "PUSH_CHAT_MESSAGE",
  replaceChatMessages: "REPLACE_CHAT_MESSAGES",
  spliceMessages: "SPLICE_MESSAGES",
  resetMessages: "RESET_MESSAGES",
  setChatRuntime: "SET_CHAT_RUNTIME",
  resetChatRuntime: "RESET_CHAT_RUNTIME",
  resetImageList: "RESET_IMAGE_LIST",
  pushImage: "PUSH_IMAGE",
  deleteImage: "DELETE_IMAGE",
  setModalImage: "SET_MODAL_IMAGE",
};

const actions = {
  login({ commit }) {
    commit("SET_USER_LOGIN_INFO", { username: WORKSPACE_ID, password: "", uid: WORKSPACE_ID });
    commit("SET_LOGIN_STATE", true);
  },
  ...Object.fromEntries(Object.entries(passthroughActions).map(([actionName, mutationName]) => [actionName, createCommitAction(mutationName)])),
};

export default createStore({
  state,
  mutations,
  actions,
});
