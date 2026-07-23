import { createStore, useStore, type Store } from "vuex";
import { ChatState } from "./chat";
import { ImageState } from "./image";
import { ModalState } from "./modal";
import { WorkspaceState } from "./workspace";
import { VideoState } from "./video";

const state = {
  ...WorkspaceState,
  ...ChatState,
  ...ImageState,
  ...VideoState,
  ...ModalState,
};

export type AppState = typeof state;

const mutationMethods = [
  "setModels",
  "setCurChatModel",
  "setChatInsTemplateList",
  "setCurChatModelSettings",
  "resetChatList",
  "setChatLoaded",
  "setCurChatId",
  "hydrateChatSession",
  "removeChatSession",
  "setInputCapability",
  "resetInputCapabilities",
  "pushChatMessage",
  "replaceChatMessages",
  "setChatRuntime",
  "resetChatRuntime",
  "resetImageList",
  "pushImage",
  "deleteImage",
  "resetImageConversationList",
  "pushImageConversation",
  "deleteImageConversation",
  "setCurImageConversationId",
  "resetImageMessages",
  "pushImageMessage",
  "updateImageMessage",
  "setImageRuntime",
  "resetImageRuntime",
  "resetVideoList",
  "pushVideo",
  "deleteVideo",
  "resetVideoConversationList",
  "pushVideoConversation",
  "deleteVideoConversation",
  "setCurVideoConversationId",
  "resetVideoMessages",
  "pushVideoMessage",
  "updateVideoMessage",
  "setVideoRuntime",
  "resetVideoRuntime",
  "setModalImage",
  "setModalChatAttachment",
] as const satisfies readonly (keyof AppState)[];

export type MutationName = (typeof mutationMethods)[number];
export type AppStore = Omit<Store<AppState>, "commit"> & {
  commit(type: MutationName, payload?: unknown): void;
};

/** Typed Store entry point for Vue components. */
export function useAppStore(): AppStore {
  return useStore<AppState>() as AppStore;
}

function createStateMutation(methodName: string) {
  return (storeState: Record<string, any>, payload: unknown) => {
    const method = storeState[methodName];
    if (typeof method !== "function") throw new Error(`Unknown state mutation method: ${methodName}`);
    method.call(storeState, payload);
    if (methodName === "setCurChatId" && typeof storeState._syncActiveChatState === "function") {
      storeState._syncActiveChatState();
    }
  };
}

/**
 * Vuex is only the reactive in-memory projection. Mutations use the same names
 * as state operations; there is intentionally no pass-through Action layer.
 */
const mutations = Object.fromEntries(mutationMethods.map((methodName) => [methodName, createStateMutation(methodName)]));

export default createStore<AppState>({ state, mutations });
