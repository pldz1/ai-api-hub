import type { ModelSettings, PersistedChatSettings } from "@/types";

const STORAGE_KEY = "ai-api-hub.workspace.v4";

export interface StoredChatConversation {
  cid: string;
  cname: string;
  settings: PersistedChatSettings | null;
}

export interface StoredImageAsset {
  id: string;
  prompt: string;
}

export interface StoredVideoAsset {
  id: string;
  prompt: string;
}

export interface StoredImageConversation {
  iid: string;
  iname: string;
}

export interface StoredVideoConversation {
  vid: string;
  vname: string;
}

export interface BrowserWorkspaceState {
  models: ModelSettings;
  chatInstructionTemplates: unknown[];
  chats: StoredChatConversation[];
  images: StoredImageAsset[];
  imageConversations: StoredImageConversation[];
  videos: StoredVideoAsset[];
  videoConversations: StoredVideoConversation[];
}

function emptyModels(): ModelSettings {
  return { chat: [], image: [], video: [] };
}

function createEmptyState(): BrowserWorkspaceState {
  return {
    models: emptyModels(),
    chatInstructionTemplates: [],
    chats: [],
    images: [],
    imageConversations: [],
    videos: [],
    videoConversations: [],
  };
}

function arrayOrEmpty<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function readBrowserWorkspace(): BrowserWorkspaceState {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return createEmptyState();

  try {
    const value = JSON.parse(raw) as Partial<BrowserWorkspaceState> | null;
    if (!value || typeof value !== "object") return createEmptyState();
    const models = value.models && typeof value.models === "object" ? value.models : emptyModels();
    return {
      models: {
        chat: arrayOrEmpty(models.chat),
        image: arrayOrEmpty(models.image),
        video: arrayOrEmpty(models.video),
      },
      chatInstructionTemplates: arrayOrEmpty(value.chatInstructionTemplates),
      chats: arrayOrEmpty(value.chats),
      images: arrayOrEmpty(value.images),
      imageConversations: arrayOrEmpty(value.imageConversations),
      videos: arrayOrEmpty(value.videos),
      videoConversations: arrayOrEmpty(value.videoConversations),
    };
  } catch (error) {
    console.warn("Failed to read browser workspace:", error);
    return createEmptyState();
  }
}

export function writeBrowserWorkspace(state: BrowserWorkspaceState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Failed to persist browser workspace.");
  }
}

export function updateBrowserWorkspace(mutator: (state: BrowserWorkspaceState) => void): BrowserWorkspaceState {
  const state = readBrowserWorkspace();
  mutator(state);
  writeBrowserWorkspace(state);
  return state;
}
