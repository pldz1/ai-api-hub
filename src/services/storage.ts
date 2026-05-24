import { tr } from "@/i18n";
import type {
  ApiMethod,
  ApiResponse,
  ChatListItem,
  ImageConversationListItem,
  ImageDataItem,
  RequestBody,
  RequestHeaders,
  StoredChatMessage,
  StoredImageConversation,
} from "@/services/types";

const STORAGE_KEY = "chat-playground.local-storage.v2";
const IMAGE_DB_NAME = "ai-api-hub-images";
const IMAGE_STORE_NAME = "images";
const DEFAULT_HEADERS: RequestHeaders = { "Content-Type": "application/json" };
const DEFAULT_TIMEOUT = 3600000;

interface StoredChatState extends ChatListItem {
  settings: string;
  messages: StoredChatMessage[];
}

interface StoredImageRecord {
  id: string;
  prompt: string;
  src?: string;
}

interface LocalStorageState {
  models: string;
  chatInsTemplateList: string;
  chats: StoredChatState[];
  images: StoredImageRecord[];
  imageConversations: StoredImageConversation[];
}

type LocalRouteHandler = (body: RequestBody) => Promise<ApiResponse>;
type StoredImageSourceMap = Map<string, string>;

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

const DEFAULT_STATE: LocalStorageState = {
  models: "",
  chatInsTemplateList: "",
  chats: [],
  images: [],
  imageConversations: [],
};

const DEFAULT_MODELS = {
  chat: [],
  image: [],
};

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function readStorageState(): LocalStorageState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? { ...DEFAULT_STATE, ...parsed } : { ...DEFAULT_STATE };
  } catch (error) {
    console.warn("Failed to read localStorage state:", error);
    return { ...DEFAULT_STATE };
  }
}

function persistStorageState(state: LocalStorageState): ApiResponse<null> {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return ok(null);
  } catch (error) {
    console.error("Failed to write localStorage state:", error);
    return fail(toErrorMessage(error, tr("storage.requestFailed")));
  }
}

function assertStorageStateWritten(state: LocalStorageState): void {
  const result = persistStorageState(state);
  if (!result.flag) throw new Error(result.log);
}

function findChat(state: LocalStorageState, cid: string): StoredChatState | null {
  return state.chats.find((item) => item.cid === cid) || null;
}

function findImageConversation(state: LocalStorageState, iid: string): StoredImageConversation | null {
  return state.imageConversations.find((item) => item.iid === iid) || null;
}

function ok<TData = null>(data: TData = null as TData, log = "Successfully."): ApiResponse<TData> {
  return { flag: true, log, data };
}

function fail(log: string): ApiResponse<null> {
  return { flag: false, log, data: null };
}

function openImageDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this environment."));
      return;
    }

    const request = indexedDB.open(IMAGE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IMAGE_STORE_NAME)) {
        db.createObjectStore(IMAGE_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open the image database."));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed."));
  });
}

async function withImageStore<T>(mode: IDBTransactionMode, callback: (store: IDBObjectStore) => Promise<T>): Promise<T> {
  const db = await openImageDatabase();

  try {
    const transaction = db.transaction(IMAGE_STORE_NAME, mode);
    const store = transaction.objectStore(IMAGE_STORE_NAME);
    const transactionDone = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Image storage transaction failed."));
      transaction.onabort = () => reject(transaction.error || new Error("Image storage transaction was aborted."));
    });
    const result = await callback(store);
    await transactionDone;

    return result;
  } finally {
    db.close();
  }
}

async function setImageSource(imageId: string, src: string): Promise<void> {
  await withImageStore("readwrite", async (store) => {
    await requestToPromise(store.put(src, imageId));
  });
}

async function getImageSource(imageId: string): Promise<string> {
  const result = await withImageStore("readonly", async (store) => {
    return (await requestToPromise(store.get(imageId))) || "";
  });
  return typeof result === "string" ? result : "";
}

async function deleteImageSource(imageId: string): Promise<void> {
  await withImageStore("readwrite", async (store) => {
    await requestToPromise(store.delete(imageId));
  });
}

function normalizeStoredImageRecords(items: unknown[] = []): StoredImageRecord[] {
  const records: Array<StoredImageRecord | null> = (Array.isArray(items) ? items : []).map((item) => {
      const record = item && typeof item === "object" ? (item as StoredImageRecord) : null;
      const id = asString(record?.id);
      if (!id) return null;
      return {
        id,
        prompt: asString(record?.prompt),
        src: asString(record?.src),
      };
    });

  return records.filter((item): item is StoredImageRecord => Boolean(item));
}

async function migrateLegacyInlineImages(state: LocalStorageState): Promise<StoredImageRecord[]> {
  const normalizedImages = normalizeStoredImageRecords(state.images);
  const inlineImages = normalizedImages.filter((item) => item.src);

  if (inlineImages.length > 0) {
    await Promise.all(inlineImages.map((item) => setImageSource(item.id, item.src || "")));
    state.images = normalizedImages.map(({ id, prompt }) => ({ id, prompt }));
    assertStorageStateWritten(state);
    return state.images;
  }

  state.images = normalizedImages.map(({ id, prompt }) => ({ id, prompt }));
  return state.images;
}

async function readStoredImageSources(imageIds: string[] = []): Promise<StoredImageSourceMap> {
  const entries = await Promise.all(
    imageIds.map(async (id) => {
      const src = await getImageSource(id);
      return [id, src] as const;
    }),
  );
  return new Map(entries);
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
  const state = readStorageState();
  return ok(state.models || "");
}

async function handleSetModels(body: RequestBody): Promise<ApiResponse<null>> {
  const state = readStorageState();
  state.models = asString(body.data, JSON.stringify(DEFAULT_MODELS));
  assertStorageStateWritten(state);
  return ok(null);
}

async function handleGetChatInsTemplateList(): Promise<ApiResponse<string>> {
  const state = readStorageState();
  return ok(state.chatInsTemplateList || "");
}

async function handleSetChatInsTemplateList(body: RequestBody): Promise<ApiResponse<null>> {
  const state = readStorageState();
  state.chatInsTemplateList = asString(body.data, "[]");
  assertStorageStateWritten(state);
  return ok(null);
}

async function handleGetChatList(): Promise<ApiResponse<ChatListItem[]>> {
  const state = readStorageState();
  return ok(state.chats.map(({ cid, cname }) => ({ cid, cname })));
}

async function handleAddChat(body: RequestBody): Promise<ApiResponse<null>> {
  const state = readStorageState();
  const cid = asString(body.cid);
  const cname = asString(body.cname);

  if (!findChat(state, cid)) {
    state.chats.push({
      cid,
      cname,
      settings: "",
      messages: [],
    });
    assertStorageStateWritten(state);
  }

  return ok(null);
}

async function handleDeleteChat(body: RequestBody): Promise<ApiResponse<null>> {
  const state = readStorageState();
  const cid = asString(body.cid);
  state.chats = state.chats.filter((item) => item.cid !== cid);
  assertStorageStateWritten(state);
  return ok(null);
}

async function handleRenameChat(body: RequestBody): Promise<ApiResponse<null>> {
  const state = readStorageState();
  const chat = findChat(state, asString(body.cid));
  if (!chat) return fail("Chat not found.");
  chat.cname = asString(body.cname);
  assertStorageStateWritten(state);
  return ok(null);
}

async function handleGetAllMessage(body: RequestBody): Promise<ApiResponse<StoredChatMessage[]>> {
  const state = readStorageState();
  const chat = findChat(state, asString(body.cid));
  return ok(chat?.messages || []);
}

async function handleAddMessage(body: RequestBody): Promise<ApiResponse<null>> {
  const state = readStorageState();
  const chat = findChat(state, asString(body.cid));
  if (!chat) return fail("Chat not found.");

  const mid = asString(body.mid);
  const nextItem: StoredChatMessage = { mid, message: asString(body.message) };
  const index = chat.messages.findIndex((item) => item.mid === mid);
  if (index >= 0) chat.messages[index] = nextItem;
  else chat.messages.push(nextItem);

  assertStorageStateWritten(state);
  return ok(null);
}

async function handleDeleteMessage(body: RequestBody): Promise<ApiResponse<null>> {
  const state = readStorageState();
  const chat = findChat(state, asString(body.cid));
  if (!chat) return fail("Chat not found.");

  const mid = asString(body.mid);
  chat.messages = chat.messages.filter((item) => item.mid !== mid);
  assertStorageStateWritten(state);
  return ok(null);
}

async function handleGetChatSettings(body: RequestBody): Promise<ApiResponse<string>> {
  const state = readStorageState();
  const chat = findChat(state, asString(body.cid));
  return ok(chat?.settings || "");
}

async function handleSetChatSettings(body: RequestBody): Promise<ApiResponse<null>> {
  const state = readStorageState();
  const chat = findChat(state, asString(body.cid));
  if (!chat) return fail("Chat not found.");
  chat.settings = asString(body.data);
  assertStorageStateWritten(state);
  return ok(null);
}

async function handleGetImageList(): Promise<ApiResponse<ImageDataItem[]>> {
  const state = readStorageState();
  const imageRecords = await migrateLegacyInlineImages(state);
  const imageSourceMap = await readStoredImageSources(imageRecords.map((item) => item.id));

  return ok(
    imageRecords.map((item) => ({
      id: item.id,
      prompt: item.prompt,
      src: imageSourceMap.get(item.id) || "",
    })),
  );
}

async function handlePushImage(body: RequestBody): Promise<ApiResponse<ImageDataItem>> {
  const state = readStorageState();
  const imageRecords = await migrateLegacyInlineImages(state);
  const imageId = asString(body.image_id);
  const prompt = asString(body.image_prompt);
  const src = await urlToDataUrl(asString(body.image_url));

  await setImageSource(imageId, src);

  const image: ImageDataItem = {
    id: imageId,
    prompt,
    src,
  };

  const nextRecord = { id: imageId, prompt };
  const index = imageRecords.findIndex((item) => item.id === imageId);
  if (index >= 0) imageRecords[index] = nextRecord;
  else imageRecords.push(nextRecord);

  state.images = imageRecords;
  assertStorageStateWritten(state);
  return ok(image);
}

async function handleDeleteImage(body: RequestBody): Promise<ApiResponse<null>> {
  const state = readStorageState();
  const imageId = asString(body.image_id);
  await migrateLegacyInlineImages(state);
  await deleteImageSource(imageId);
  state.images = state.images.filter((item) => item.id !== imageId);
  assertStorageStateWritten(state);
  return ok(null);
}

async function handleGetImageConversationList(): Promise<ApiResponse<ImageConversationListItem[]>> {
  const state = readStorageState();
  return ok(state.imageConversations.map(({ iid, iname }) => ({ iid, iname })));
}

async function handleAddImageConversation(body: RequestBody): Promise<ApiResponse<null>> {
  const state = readStorageState();
  const iid = asString(body.iid);
  const iname = asString(body.iname);
  if (!iid) return fail("Image conversation id is required.");

  if (!findImageConversation(state, iid)) {
    state.imageConversations.push({
      iid,
      iname,
      messages: "[]",
    });
    assertStorageStateWritten(state);
  }

  return ok(null);
}

async function handleDeleteImageConversation(body: RequestBody): Promise<ApiResponse<null>> {
  const state = readStorageState();
  const iid = asString(body.iid);
  state.imageConversations = state.imageConversations.filter((item) => item.iid !== iid);
  assertStorageStateWritten(state);
  return ok(null);
}

async function handleGetImageConversationMessages(body: RequestBody): Promise<ApiResponse<string>> {
  const state = readStorageState();
  return ok(findImageConversation(state, asString(body.iid))?.messages || "[]");
}

async function handleSetImageConversationMessages(body: RequestBody): Promise<ApiResponse<null>> {
  const state = readStorageState();
  const iid = asString(body.iid);
  const conversation = findImageConversation(state, iid);
  if (!conversation) return fail("Image conversation not found.");
  conversation.messages = asString(body.messages, "[]");
  assertStorageStateWritten(state);
  return ok(null);
}

const ROUTES: Record<string, LocalRouteHandler> = {
  "/_api/workspace/login": handleLogin,
  "/_api/workspace/getModels": handleGetModels,
  "/_api/workspace/setModels": handleSetModels,
  "/_api/workspace/getChatInsTemplateList": handleGetChatInsTemplateList,
  "/_api/workspace/setChatInsTemplateList": handleSetChatInsTemplateList,
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
  "/_api/image/getConversationList": handleGetImageConversationList,
  "/_api/image/addConversation": handleAddImageConversation,
  "/_api/image/deleteConversation": handleDeleteImageConversation,
  "/_api/image/getConversationMessages": handleGetImageConversationMessages,
  "/_api/image/setConversationMessages": handleSetImageConversationMessages,
};

export async function requestStorage<TData = unknown>(endpoint: string, body: RequestBody = {}): Promise<ApiResponse<TData>> {
  const handler = ROUTES[endpoint];
  if (!handler) return fail(`Local storage route not found: ${endpoint}`);

  try {
    return (await handler(body)) as ApiResponse<TData>;
  } catch (error) {
    console.error(`Local storage request failed for ${endpoint}:`, error);
    const message = error instanceof Error ? error.message : "Local storage request failed.";
    return fail(message);
  }
}

export async function apiRequest<TData = unknown>(
  method: ApiMethod,
  endpoint: string,
  body: RequestBody = {},
  headers: RequestHeaders = DEFAULT_HEADERS,
  timeout = DEFAULT_TIMEOUT,
): Promise<ApiResponse<TData>> {
  void method;
  void headers;
  void timeout;
  return requestStorage<TData>(endpoint, body);
}
