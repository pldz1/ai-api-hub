import { tr } from "@/i18n";
import type { ApiMethod, ApiResponse, RequestBody, StoredChatMessage, ChatListItem, ImageConversationListItem, ImageDataItem, ModelSettings } from "@/types";

const STORAGE_KEY = "ai-api-hub.local-storage.v2";
const IMAGE_DB_NAME = "ai-api-hub-images";
const IMAGE_STORE_NAME = "images";

interface StoredImageConversation {
  iid: string;
  iname: string;
  messages: string;
}

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
  models: ModelSettings;
  chatInsTemplateList: string;
  chats: StoredChatState[];
  images: StoredImageRecord[];
  imageConversations: StoredImageConversation[];
}

type LocalRouteHandler = (body: RequestBody) => Promise<ApiResponse>;
type StoredImageSourceMap = Map<string, string>;
type SetModelsRequestBody = RequestBody & { data: ModelSettings };

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function createDefaultModels(): ModelSettings {
  return {
    chat: [],
    image: [],
  };
}

function createDefaultState(): LocalStorageState {
  return {
    models: createDefaultModels(),
    chatInsTemplateList: "",
    chats: [],
    images: [],
    imageConversations: [],
  };
}

function normalizeStoredChatMessages(items: unknown): StoredChatMessage[] {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const record = item && typeof item === "object" ? (item as StoredChatMessage) : null;
      const mid = asString(record?.mid);
      if (!mid) return null;
      return {
        mid,
        message: asString(record?.message),
      };
    })
    .filter((item): item is StoredChatMessage => Boolean(item));
}

function normalizeStoredChats(items: unknown): StoredChatState[] {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const record = item && typeof item === "object" ? (item as StoredChatState) : null;
      const cid = asString(record?.cid);
      if (!cid) return null;
      return {
        cid,
        cname: asString(record?.cname),
        settings: asString(record?.settings),
        messages: normalizeStoredChatMessages(record?.messages),
      };
    })
    .filter((item): item is StoredChatState => Boolean(item));
}

function normalizeStoredImageConversations(items: unknown): StoredImageConversation[] {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const record = item && typeof item === "object" ? (item as StoredImageConversation) : null;
      const iid = asString(record?.iid);
      if (!iid) return null;
      return {
        iid,
        iname: asString(record?.iname),
        messages: asString(record?.messages, "[]"),
      };
    })
    .filter((item): item is StoredImageConversation => Boolean(item));
}

function readStorageState(): LocalStorageState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return createDefaultState();

    const state = { ...createDefaultState(), ...parsed };
    return {
      ...state,
      models: state.models && typeof state.models === "object" ? { ...createDefaultModels(), ...state.models } : createDefaultModels(),
      chatInsTemplateList: asString(state.chatInsTemplateList),
      chats: normalizeStoredChats(state.chats),
      images: normalizeStoredImageRecords(state.images),
      imageConversations: normalizeStoredImageConversations(state.imageConversations),
    };
  } catch (error) {
    console.warn("Failed to read localStorage state:", error);
    return createDefaultState();
  }
}

function writeStorageState(state: LocalStorageState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error("Failed to write localStorage state:", error);
    throw new Error(error instanceof Error ? error.message : tr("storage.requestFailed"));
  }
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

function fail<TData = null>(log: string): ApiResponse<TData> {
  return { flag: false, log, data: null as TData };
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
    writeStorageState(state);
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

export async function urlToDataUrl(url: string): Promise<string> {
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

async function handleGetModels(): Promise<ApiResponse<ModelSettings>> {
  const state = readStorageState();
  return ok(state.models);
}

async function handleSetModels(body: SetModelsRequestBody): Promise<ApiResponse<null>> {
  const state = readStorageState();
  state.models = body.data;
  writeStorageState(state);
  return ok(null);
}

async function handleGetChatInsTemplateList(): Promise<ApiResponse<string>> {
  const state = readStorageState();
  return ok(state.chatInsTemplateList || "");
}

async function handleSetChatInsTemplateList(body: RequestBody): Promise<ApiResponse<null>> {
  const state = readStorageState();
  state.chatInsTemplateList = asString(body.data, "[]");
  writeStorageState(state);
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
  if (!cid) return fail("Chat id is required.");

  if (!findChat(state, cid)) {
    state.chats.push({
      cid,
      cname,
      settings: "",
      messages: [],
    });
    writeStorageState(state);
  }

  return ok(null);
}

async function handleDeleteChat(body: RequestBody): Promise<ApiResponse<null>> {
  const state = readStorageState();
  const cid = asString(body.cid);
  if (!cid) return fail("Chat id is required.");
  state.chats = state.chats.filter((item) => item.cid !== cid);
  writeStorageState(state);
  return ok(null);
}

async function handleRenameChat(body: RequestBody): Promise<ApiResponse<null>> {
  const state = readStorageState();
  const chat = findChat(state, asString(body.cid));
  if (!chat) return fail("Chat not found.");
  chat.cname = asString(body.cname);
  writeStorageState(state);
  return ok(null);
}

async function handleGetAllMessage(body: RequestBody): Promise<ApiResponse<StoredChatMessage[]>> {
  const state = readStorageState();
  const cid = asString(body.cid);
  if (!cid) return fail("Chat id is required.");
  const chat = findChat(state, cid);
  return ok(chat?.messages || []);
}

async function handleAddMessage(body: RequestBody): Promise<ApiResponse<null>> {
  const state = readStorageState();
  const cid = asString(body.cid);
  const mid = asString(body.mid);
  if (!cid) return fail("Chat id is required.");
  if (!mid) return fail("Message id is required.");

  const chat = findChat(state, cid);
  if (!chat) return fail("Chat not found.");

  const nextItem: StoredChatMessage = { mid, message: asString(body.message) };
  const index = chat.messages.findIndex((item) => item.mid === mid);
  if (index >= 0) chat.messages[index] = nextItem;
  else chat.messages.push(nextItem);

  writeStorageState(state);
  return ok(null);
}

async function handleDeleteMessage(body: RequestBody): Promise<ApiResponse<null>> {
  const state = readStorageState();
  const cid = asString(body.cid);
  const mid = asString(body.mid);
  if (!cid) return fail("Chat id is required.");
  if (!mid) return fail("Message id is required.");

  const chat = findChat(state, cid);
  if (!chat) return fail("Chat not found.");

  chat.messages = chat.messages.filter((item) => item.mid !== mid);
  writeStorageState(state);
  return ok(null);
}

async function handleGetChatSettings(body: RequestBody): Promise<ApiResponse<string>> {
  const state = readStorageState();
  const cid = asString(body.cid);
  if (!cid) return fail("Chat id is required.");
  const chat = findChat(state, cid);
  return ok(chat?.settings || "");
}

async function handleSetChatSettings(body: RequestBody): Promise<ApiResponse<null>> {
  const state = readStorageState();
  const chat = findChat(state, asString(body.cid));
  if (!chat) return fail("Chat not found.");
  chat.settings = asString(body.data);
  writeStorageState(state);
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
  if (!imageId) return fail("Image id is required.");
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
  writeStorageState(state);
  return ok(image);
}

async function handleDeleteImage(body: RequestBody): Promise<ApiResponse<null>> {
  const state = readStorageState();
  const imageId = asString(body.image_id);
  if (!imageId) return fail("Image id is required.");
  await migrateLegacyInlineImages(state);
  await deleteImageSource(imageId);
  state.images = state.images.filter((item) => item.id !== imageId);
  writeStorageState(state);
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
    writeStorageState(state);
  }

  return ok(null);
}

async function handleDeleteImageConversation(body: RequestBody): Promise<ApiResponse<null>> {
  const state = readStorageState();
  const iid = asString(body.iid);
  if (!iid) return fail("Image conversation id is required.");
  state.imageConversations = state.imageConversations.filter((item) => item.iid !== iid);
  writeStorageState(state);
  return ok(null);
}

async function handleGetImageConversationMessages(body: RequestBody): Promise<ApiResponse<string>> {
  const state = readStorageState();
  const iid = asString(body.iid);
  if (!iid) return fail("Image conversation id is required.");
  return ok(findImageConversation(state, iid)?.messages || "[]");
}

async function handleSetImageConversationMessages(body: RequestBody): Promise<ApiResponse<null>> {
  const state = readStorageState();
  const iid = asString(body.iid);
  const conversation = findImageConversation(state, iid);
  if (!conversation) return fail("Image conversation not found.");
  conversation.messages = asString(body.messages, "[]");
  writeStorageState(state);
  return ok(null);
}

const ROUTES: Record<string, LocalRouteHandler> = {
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

export async function apiRequest<TData = unknown>(method: ApiMethod, endpoint: string, body: RequestBody = {}): Promise<ApiResponse<TData>> {
  void method;
  return requestStorage<TData>(endpoint, body);
}
