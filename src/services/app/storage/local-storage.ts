import { tr } from "@/i18n";
import type {
  ApiMethod,
  ApiResponse,
  RequestBody,
  StoredChatMessage,
  ChatListItem,
  ImageConversationListItem,
  ImageDataItem,
  ModelSettings,
  VideoConversationListItem,
  VideoDataItem,
} from "@/types";
import {
  setImageSource,
  getImageSource,
  deleteImageSource,
  setVideoSource,
  getVideoSource,
  deleteVideoSource,
  deleteChatFileSource,
  urlToDataUrl,
} from "./indexeddb";

const STORAGE_KEY = "ai-api-hub.local-storage.v2";

interface StoredImageConversation {
  iid: string;
  iname: string;
  messages: string;
}

interface StoredVideoConversation {
  vid: string;
  vname: string;
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

interface StoredVideoRecord {
  id: string;
  prompt: string;
}

interface LocalStorageState {
  models: ModelSettings;
  chatInsTemplateList: string;
  chats: StoredChatState[];
  images: StoredImageRecord[];
  imageConversations: StoredImageConversation[];
  videos: StoredVideoRecord[];
  videoConversations: StoredVideoConversation[];
}

type LocalRouteHandler = (body: RequestBody) => Promise<ApiResponse>;
type StoredImageSourceMap = Map<string, string>;
type StoredVideoSourceMap = Map<string, string>;
type SetModelsRequestBody = RequestBody & { data: ModelSettings };

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function createDefaultModels(): ModelSettings {
  return {
    chat: [],
    image: [],
    video: [],
  };
}

function createDefaultState(): LocalStorageState {
  return {
    models: createDefaultModels(),
    chatInsTemplateList: "",
    chats: [],
    images: [],
    imageConversations: [],
    videos: [],
    videoConversations: [],
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

function normalizeStoredVideoRecords(items: unknown[] = []): StoredVideoRecord[] {
  const records: Array<StoredVideoRecord | null> = (Array.isArray(items) ? items : []).map((item) => {
    const record = item && typeof item === "object" ? (item as StoredVideoRecord) : null;
    const id = asString(record?.id);
    if (!id) return null;
    return { id, prompt: asString(record?.prompt) };
  });

  return records.filter((item): item is StoredVideoRecord => Boolean(item));
}

function collectChatAttachmentIds(messages: StoredChatMessage[]): string[] {
  const ids = new Set<string>();

  messages.forEach((record) => {
    try {
      const message = JSON.parse(record.message) as { attachments?: Array<{ id?: string }> } | null;
      (message?.attachments || []).forEach((attachment) => {
        if (attachment?.id) ids.add(attachment.id);
      });
    } catch {
      // Ignore malformed records while cleaning up attachment blobs.
    }
  });

  return [...ids];
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

function findVideoConversation(state: LocalStorageState, vid: string): StoredVideoConversation | null {
  return state.videoConversations.find((item) => item.vid === vid) || null;
}

function ok<TData = null>(data: TData = null as TData, log = "Successfully."): ApiResponse<TData> {
  return { flag: true, log, data };
}

function fail<TData = null>(log: string): ApiResponse<TData> {
  return { flag: false, log, data: null as TData };
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

async function readStoredVideoSources(videoIds: string[] = []): Promise<StoredVideoSourceMap> {
  const entries = await Promise.all(
    videoIds.map(async (id) => {
      const src = await getVideoSource(id);
      return [id, src] as const;
    }),
  );
  return new Map(entries);
}

// -- handlers -----------------------------------------------------------------

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
  const chat = findChat(state, cid);
  if (!chat) return fail("Chat not found.");

  state.chats = state.chats.filter((item) => item.cid !== cid);
  writeStorageState(state);
  void Promise.allSettled(collectChatAttachmentIds(chat.messages || []).map((attachmentId) => deleteChatFileSource(attachmentId)));
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

  const targetMessage = chat.messages.find((item) => item.mid === mid);
  chat.messages = chat.messages.filter((item) => item.mid !== mid);
  writeStorageState(state);
  if (targetMessage) {
    void Promise.allSettled(collectChatAttachmentIds([targetMessage]).map((attachmentId) => deleteChatFileSource(attachmentId)));
  }
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

async function handleGetVideoList(): Promise<ApiResponse<VideoDataItem[]>> {
  const state = readStorageState();
  const videoRecords = normalizeStoredVideoRecords(state.videos);
  const videoSourceMap = await readStoredVideoSources(videoRecords.map((item) => item.id));

  return ok(
    videoRecords.map((item) => ({
      id: item.id,
      prompt: item.prompt,
      src: videoSourceMap.get(item.id) || "",
    })),
  );
}

async function handlePushVideo(body: RequestBody): Promise<ApiResponse<VideoDataItem>> {
  const state = readStorageState();
  const videoId = asString(body.video_id);
  const prompt = asString(body.video_prompt);
  if (!videoId) return fail("Video id is required.");
  const src = await urlToDataUrl(asString(body.video_url));

  await setVideoSource(videoId, src);

  const video: VideoDataItem = { id: videoId, prompt, src };
  const nextRecord = { id: videoId, prompt };
  const videoRecords = normalizeStoredVideoRecords(state.videos);
  const index = videoRecords.findIndex((item) => item.id === videoId);
  if (index >= 0) videoRecords[index] = nextRecord;
  else videoRecords.push(nextRecord);

  state.videos = videoRecords;
  writeStorageState(state);
  return ok(video);
}

async function handleDeleteVideo(body: RequestBody): Promise<ApiResponse<null>> {
  const state = readStorageState();
  const videoId = asString(body.video_id);
  if (!videoId) return fail("Video id is required.");
  await deleteVideoSource(videoId);
  state.videos = state.videos.filter((item) => item.id !== videoId);
  writeStorageState(state);
  return ok(null);
}

async function handleGetVideoConversationList(): Promise<ApiResponse<VideoConversationListItem[]>> {
  const state = readStorageState();
  return ok(state.videoConversations.map(({ vid, vname }) => ({ vid, vname })));
}

async function handleAddVideoConversation(body: RequestBody): Promise<ApiResponse<null>> {
  const state = readStorageState();
  const vid = asString(body.vid);
  const vname = asString(body.vname);
  if (!vid) return fail("Video conversation id is required.");

  if (!findVideoConversation(state, vid)) {
    state.videoConversations.push({ vid, vname, messages: "[]" });
    writeStorageState(state);
  }

  return ok(null);
}

async function handleDeleteVideoConversation(body: RequestBody): Promise<ApiResponse<null>> {
  const state = readStorageState();
  const vid = asString(body.vid);
  if (!vid) return fail("Video conversation id is required.");
  state.videoConversations = state.videoConversations.filter((item) => item.vid !== vid);
  writeStorageState(state);
  return ok(null);
}

async function handleGetVideoConversationMessages(body: RequestBody): Promise<ApiResponse<string>> {
  const state = readStorageState();
  const vid = asString(body.vid);
  if (!vid) return fail("Video conversation id is required.");
  return ok(findVideoConversation(state, vid)?.messages || "[]");
}

async function handleSetVideoConversationMessages(body: RequestBody): Promise<ApiResponse<null>> {
  const state = readStorageState();
  const vid = asString(body.vid);
  const conversation = findVideoConversation(state, vid);
  if (!conversation) return fail("Video conversation not found.");
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
  "/_api/video/getVideoList": handleGetVideoList,
  "/_api/video/pushVideo": handlePushVideo,
  "/_api/video/deleteVideo": handleDeleteVideo,
  "/_api/video/getConversationList": handleGetVideoConversationList,
  "/_api/video/addConversation": handleAddVideoConversation,
  "/_api/video/deleteConversation": handleDeleteVideoConversation,
  "/_api/video/getConversationMessages": handleGetVideoConversationMessages,
  "/_api/video/setConversationMessages": handleSetVideoConversationMessages,
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
