import { createStore } from "vuex";
import { ChatState } from "./chat";
import { UserState } from "./user";
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
  RESET_IMAGE_CONVERSATION_LIST: createStateMutation("resetImageConversationList"),
  PUSH_IMAGE_CONVERSATION: createStateMutation("pushImageConversation"),
  DELETE_IMAGE_CONVERSATION: createStateMutation("deleteImageConversation"),
  SET_CURRENT_IMAGE_CONVERSATION_ID: createStateMutation("setCurImageConversationId"),
  RESET_IMAGE_MESSAGES: createStateMutation("resetImageMessages"),
  PUSH_IMAGE_MESSAGE: createStateMutation("pushImageMessage"),
  UPDATE_IMAGE_MESSAGE: createStateMutation("updateImageMessage"),
  SET_IMAGE_RUNTIME: createStateMutation("setImageRuntime"),
  RESET_IMAGE_RUNTIME: createStateMutation("resetImageRuntime"),
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
  resetImageConversationList: "RESET_IMAGE_CONVERSATION_LIST",
  pushImageConversation: "PUSH_IMAGE_CONVERSATION",
  deleteImageConversation: "DELETE_IMAGE_CONVERSATION",
  setCurImageConversationId: "SET_CURRENT_IMAGE_CONVERSATION_ID",
  resetImageMessages: "RESET_IMAGE_MESSAGES",
  pushImageMessage: "PUSH_IMAGE_MESSAGE",
  updateImageMessage: "UPDATE_IMAGE_MESSAGE",
  setImageRuntime: "SET_IMAGE_RUNTIME",
  resetImageRuntime: "RESET_IMAGE_RUNTIME",
  setModalImage: "SET_MODAL_IMAGE",
};

const actions = {
  ...Object.fromEntries(Object.entries(passthroughActions).map(([actionName, mutationName]) => [actionName, createCommitAction(mutationName)])),
};

export default createStore({
  state,
  mutations,
  actions,
});
