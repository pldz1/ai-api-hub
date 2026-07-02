import { tr } from "@/i18n";

const IMAGE_DB_NAME = "ai-api-hub-images";
const IMAGE_STORE_NAME = "images";
const VIDEO_DB_NAME = "ai-api-hub-videos";
const VIDEO_STORE_NAME = "videos";
const CHAT_FILE_DB_NAME = "ai-api-hub-chat-files";
const CHAT_FILE_STORE_NAME = "chat-files";

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed."));
  });
}

// -- image IndexedDB ----------------------------------------------------------

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

export async function setImageSource(imageId: string, src: string): Promise<void> {
  await withImageStore("readwrite", async (store) => {
    await requestToPromise(store.put(src, imageId));
  });
}

export async function getImageSource(imageId: string): Promise<string> {
  const result = await withImageStore("readonly", async (store) => {
    return (await requestToPromise(store.get(imageId))) || "";
  });
  return typeof result === "string" ? result : "";
}

export async function deleteImageSource(imageId: string): Promise<void> {
  await withImageStore("readwrite", async (store) => {
    await requestToPromise(store.delete(imageId));
  });
}

// -- video IndexedDB ----------------------------------------------------------

function openVideoDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this environment."));
      return;
    }

    const request = indexedDB.open(VIDEO_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(VIDEO_STORE_NAME)) {
        db.createObjectStore(VIDEO_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open the video database."));
  });
}

async function withVideoStore<T>(mode: IDBTransactionMode, callback: (store: IDBObjectStore) => Promise<T>): Promise<T> {
  const db = await openVideoDatabase();

  try {
    const transaction = db.transaction(VIDEO_STORE_NAME, mode);
    const store = transaction.objectStore(VIDEO_STORE_NAME);
    const transactionDone = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Video storage transaction failed."));
      transaction.onabort = () => reject(transaction.error || new Error("Video storage transaction was aborted."));
    });
    const result = await callback(store);
    await transactionDone;

    return result;
  } finally {
    db.close();
  }
}

export async function setVideoSource(videoId: string, src: string): Promise<void> {
  await withVideoStore("readwrite", async (store) => {
    await requestToPromise(store.put(src, videoId));
  });
}

export async function getVideoSource(videoId: string): Promise<string> {
  const result = await withVideoStore("readonly", async (store) => {
    return (await requestToPromise(store.get(videoId))) || "";
  });
  return typeof result === "string" ? result : "";
}

export async function deleteVideoSource(videoId: string): Promise<void> {
  await withVideoStore("readwrite", async (store) => {
    await requestToPromise(store.delete(videoId));
  });
}

// -- chat attachment IndexedDB ------------------------------------------------

function openChatFileDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this environment."));
      return;
    }

    const request = indexedDB.open(CHAT_FILE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CHAT_FILE_STORE_NAME)) {
        db.createObjectStore(CHAT_FILE_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open the chat file database."));
  });
}

async function withChatFileStore<T>(mode: IDBTransactionMode, callback: (store: IDBObjectStore) => Promise<T>): Promise<T> {
  const db = await openChatFileDatabase();

  try {
    const transaction = db.transaction(CHAT_FILE_STORE_NAME, mode);
    const store = transaction.objectStore(CHAT_FILE_STORE_NAME);
    const transactionDone = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("Chat file storage transaction failed."));
      transaction.onabort = () => reject(transaction.error || new Error("Chat file storage transaction was aborted."));
    });
    const result = await callback(store);
    await transactionDone;

    return result;
  } finally {
    db.close();
  }
}

export async function setChatFileSource(fileId: string, source: Blob): Promise<void> {
  await withChatFileStore("readwrite", async (store) => {
    await requestToPromise(store.put(source, fileId));
  });
}

export async function getChatFileSource(fileId: string): Promise<Blob | null> {
  const result = await withChatFileStore("readonly", async (store) => {
    return (await requestToPromise(store.get(fileId))) || null;
  });
  return result instanceof Blob ? result : null;
}

export async function deleteChatFileSource(fileId: string): Promise<void> {
  await withChatFileStore("readwrite", async (store) => {
    await requestToPromise(store.delete(fileId));
  });
}

// -- utilities ----------------------------------------------------------------

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
