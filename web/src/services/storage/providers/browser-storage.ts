import { tr } from "@/i18n";
import type { ApiResponse, ChatListItem, ImageDataItem, RequestBody, StoredChatMessage } from "@/services/types";

const STORAGE_KEY = "chat-playground.browser-storage.v2";

interface BrowserChatState extends ChatListItem {
  settings: string;
  messages: StoredChatMessage[];
}

interface BrowserStorageState {
  models: string;
  chatInsTemplateList: string;
  chats: BrowserChatState[];
  images: ImageDataItem[];
}

type BrowserRouteHandler = (body: RequestBody) => Promise<ApiResponse>;

function asString(value: unknown, fallback: string = ""): string {
  return typeof value === "string" ? value : fallback;
}

const DEFAULT_STATE = {
  models: "",
  chatInsTemplateList: "",
  chats: [],
  images: [],
};

const DEFAULT_MODELS = {
  chat: [],
  imageGeneration: [],
  imageEdit: [],
  image: [],
  rtaudio: [],
};

function readState(): BrowserStorageState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? { ...DEFAULT_STATE, ...parsed } : { ...DEFAULT_STATE };
  } catch (error) {
    console.warn("Failed to read browser storage state:", error);
    return { ...DEFAULT_STATE };
  }
}

function writeState(state: BrowserStorageState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function findChat(state: BrowserStorageState, cid: string): BrowserChatState | null {
  return state.chats.find((item) => item.cid === cid) || null;
}

function ok<TData = null>(data: TData = null as TData, log: string = "Successfully."): ApiResponse<TData> {
  return { flag: true, log, data };
}

function fail(log: string): ApiResponse<null> {
  return { flag: false, log, data: null };
}

async function urlToDataUrl(url: string): Promise<string> {
  if (!url || url.startsWith("data:")) return url;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(tr("storage.imageFetchFailed", { status: response.status }));
  }

  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error(tr("storage.imageDataUrlFailed")));
    reader.readAsDataURL(blob);
  });
}

async function handleLogin(): Promise<ApiResponse<null>> {
  return ok(null, tr("toast.loginSuccess"));
}

async function handleGetModels(): Promise<ApiResponse<string>> {
  const state = readState();
  return ok(state.models || "");
}

async function handleSetModels(body: RequestBody): Promise<ApiResponse<null>> {
  const state = readState();
  state.models = asString(body.data, JSON.stringify(DEFAULT_MODELS));
  writeState(state);
  return ok(null);
}

async function handleGetChatInsTemplateList(): Promise<ApiResponse<string>> {
  const state = readState();
  return ok(state.chatInsTemplateList || "");
}

async function handleSetChatInsTemplateList(body: RequestBody): Promise<ApiResponse<null>> {
  const state = readState();
  state.chatInsTemplateList = asString(body.data, "[]");
  writeState(state);
  return ok(null);
}

async function handleGetChatList(): Promise<ApiResponse<ChatListItem[]>> {
  const state = readState();
  return ok(state.chats.map(({ cid, cname }) => ({ cid, cname })));
}

async function handleAddChat(body: RequestBody): Promise<ApiResponse<null>> {
  const state = readState();
  const cid = asString(body.cid);
  const cname = asString(body.cname);
  if (!findChat(state, cid)) {
    state.chats.push({
      cid,
      cname,
      settings: "",
      messages: [],
    });
    writeState(state);
  }
  return ok(null);
}

async function handleDeleteChat(body: RequestBody): Promise<ApiResponse<null>> {
  const state = readState();
  const cid = asString(body.cid);
  state.chats = state.chats.filter((item) => item.cid !== cid);
  writeState(state);
  return ok(null);
}

async function handleRenameChat(body: RequestBody): Promise<ApiResponse<null>> {
  const state = readState();
  const chat = findChat(state, asString(body.cid));
  if (!chat) return fail("Chat not found.");
  chat.cname = asString(body.cname);
  writeState(state);
  return ok(null);
}

async function handleGetAllMessage(body: RequestBody): Promise<ApiResponse<StoredChatMessage[]>> {
  const state = readState();
  const chat = findChat(state, asString(body.cid));
  return ok(chat?.messages || []);
}

async function handleAddMessage(body: RequestBody): Promise<ApiResponse<null>> {
  const state = readState();
  const chat = findChat(state, asString(body.cid));
  if (!chat) return fail("Chat not found.");

  const mid = asString(body.mid);
  const nextItem: StoredChatMessage = { mid, message: asString(body.message) };
  const idx = chat.messages.findIndex((item) => item.mid === mid);
  if (idx >= 0) chat.messages[idx] = nextItem;
  else chat.messages.push(nextItem);

  writeState(state);
  return ok(null);
}

async function handleDeleteMessage(body: RequestBody): Promise<ApiResponse<null>> {
  const state = readState();
  const chat = findChat(state, asString(body.cid));
  if (!chat) return fail("Chat not found.");

  const mid = asString(body.mid);
  chat.messages = chat.messages.filter((item) => item.mid !== mid);
  writeState(state);
  return ok(null);
}

async function handleGetChatSettings(body: RequestBody): Promise<ApiResponse<string>> {
  const state = readState();
  const chat = findChat(state, asString(body.cid));
  return ok(chat?.settings || "");
}

async function handleSetChatSettings(body: RequestBody): Promise<ApiResponse<null>> {
  const state = readState();
  const chat = findChat(state, asString(body.cid));
  if (!chat) return fail("Chat not found.");
  chat.settings = asString(body.data);
  writeState(state);
  return ok(null);
}

async function handleGetImageList(): Promise<ApiResponse<ImageDataItem[]>> {
  const state = readState();
  return ok(state.images || []);
}

async function handlePushImage(body: RequestBody): Promise<ApiResponse<ImageDataItem>> {
  const state = readState();
  const imageId = asString(body.image_id);
  const prompt = asString(body.image_prompt);
  const src = await urlToDataUrl(asString(body.image_url));

  const image: ImageDataItem = {
    id: imageId,
    prompt,
    src,
  };

  const idx = state.images.findIndex((item) => item.id === imageId);
  if (idx >= 0) state.images[idx] = image;
  else state.images.push(image);

  writeState(state);
  return ok(image);
}

async function handleDeleteImage(body: RequestBody): Promise<ApiResponse<null>> {
  const state = readState();
  const imageId = asString(body.image_id);
  state.images = state.images.filter((item) => item.id !== imageId);
  writeState(state);
  return ok(null);
}

const ROUTES: Record<string, BrowserRouteHandler> = {
  "/_api/login": handleLogin,
  "/_api/user/getModels": handleGetModels,
  "/_api/user/setModels": handleSetModels,
  "/_api/user/getChatInsTemplateList": handleGetChatInsTemplateList,
  "/_api/user/setChatInsTemplateList": handleSetChatInsTemplateList,
  "/_api/chat/getChatList": handleGetChatList,
  "/_api/chat/addChat": handleAddChat,
  "/_api/chat/deleteChat": handleDeleteChat,
  "/_api/chat/renameChat": handleRenameChat,
  "/_api/chat/getAllMessage": handleGetAllMessage,
  "/_api/chat/addMessage": handleAddMessage,
  "/_api/chat/deleteMessage": handleDeleteMessage,
  "/_api/chat/getChatSettings": handleGetChatSettings,
  "/_api/chat/setChatSettings": handleSetChatSettings,
  "/_api/image/getImageList": handleGetImageList,
  "/_api/image/pushImage": handlePushImage,
  "/_api/image/deleteImage": handleDeleteImage,
};

export async function requestBrowserStorage<TData = unknown>(endpoint: string, body: RequestBody = {}): Promise<ApiResponse<TData>> {
  const handler = ROUTES[endpoint];
  if (!handler) return fail(`Browser storage route not found: ${endpoint}`);

  try {
    return (await handler(body)) as ApiResponse<TData>;
  } catch (error) {
    console.error(`Browser storage request failed for ${endpoint}:`, error);
    const message = error instanceof Error ? error.message : "Browser storage request failed.";
    return fail(message);
  }
}
