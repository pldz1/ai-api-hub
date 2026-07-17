import type { ChatPromptMessage, ImageConversationMessage, VideoConversationMessage } from "@/types";

const DATABASE_NAME = "ai-api-hub-workspace-records-v4";
const DATABASE_VERSION = 1;
const CHAT_MESSAGES_STORE = "chat-messages";
const IMAGE_MESSAGES_STORE = "image-messages";
const VIDEO_MESSAGES_STORE = "video-messages";

type MessageStoreName = typeof CHAT_MESSAGES_STORE | typeof IMAGE_MESSAGES_STORE | typeof VIDEO_MESSAGES_STORE;

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB record request failed."));
  });
}

function openRecordDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this environment."));
      return;
    }

    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      [CHAT_MESSAGES_STORE, IMAGE_MESSAGES_STORE, VIDEO_MESSAGES_STORE].forEach((storeName) => {
        if (!database.objectStoreNames.contains(storeName)) database.createObjectStore(storeName);
      });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open the workspace record database."));
  });
}

async function withRecordStore<T>(storeName: MessageStoreName, mode: IDBTransactionMode, callback: (store: IDBObjectStore) => Promise<T>): Promise<T> {
  const database = await openRecordDatabase();
  try {
    const transaction = database.transaction(storeName, mode);
    const done = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error(`${storeName} transaction failed.`));
      transaction.onabort = () => reject(transaction.error || new Error(`${storeName} transaction was aborted.`));
    });
    const result = await callback(transaction.objectStore(storeName));
    await done;
    return result;
  } finally {
    database.close();
  }
}

async function readMessages<T>(storeName: MessageStoreName, conversationId: string): Promise<T[]> {
  const value = await withRecordStore(storeName, "readonly", (store) => requestToPromise(store.get(conversationId)));
  return Array.isArray(value) ? (value as T[]) : [];
}

async function writeMessages<T>(storeName: MessageStoreName, conversationId: string, messages: T[]): Promise<void> {
  await withRecordStore(storeName, "readwrite", async (store) => void (await requestToPromise(store.put(messages, conversationId))));
}

async function deleteMessages(storeName: MessageStoreName, conversationId: string): Promise<void> {
  await withRecordStore(storeName, "readwrite", async (store) => void (await requestToPromise(store.delete(conversationId))));
}

export const getChatMessageRecords = (cid: string) => readMessages<ChatPromptMessage>(CHAT_MESSAGES_STORE, cid);
export const setChatMessageRecords = (cid: string, messages: ChatPromptMessage[]) => writeMessages(CHAT_MESSAGES_STORE, cid, messages);
export const deleteChatMessageRecords = (cid: string) => deleteMessages(CHAT_MESSAGES_STORE, cid);

export const getImageMessageRecords = (iid: string) => readMessages<ImageConversationMessage>(IMAGE_MESSAGES_STORE, iid);
export const setImageMessageRecords = (iid: string, messages: ImageConversationMessage[]) => writeMessages(IMAGE_MESSAGES_STORE, iid, messages);
export const deleteImageMessageRecords = (iid: string) => deleteMessages(IMAGE_MESSAGES_STORE, iid);

export const getVideoMessageRecords = (vid: string) => readMessages<VideoConversationMessage>(VIDEO_MESSAGES_STORE, vid);
export const setVideoMessageRecords = (vid: string, messages: VideoConversationMessage[]) => writeMessages(VIDEO_MESSAGES_STORE, vid, messages);
export const deleteVideoMessageRecords = (vid: string) => deleteMessages(VIDEO_MESSAGES_STORE, vid);
