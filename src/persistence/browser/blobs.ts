const IMAGE_DB = { name: "ai-api-hub-images", store: "images" } as const;
const VIDEO_DB = { name: "ai-api-hub-videos", store: "videos" } as const;
const CHAT_FILE_DB = { name: "ai-api-hub-chat-files", store: "chat-files" } as const;

interface DatabaseDescriptor {
  name: string;
  store: string;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed."));
  });
}

function openDatabase(descriptor: DatabaseDescriptor): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this environment."));
      return;
    }
    const request = indexedDB.open(descriptor.name, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(descriptor.store)) {
        request.result.createObjectStore(descriptor.store);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error(`Failed to open ${descriptor.name}.`));
  });
}

async function withStore<T>(descriptor: DatabaseDescriptor, mode: IDBTransactionMode, callback: (store: IDBObjectStore) => Promise<T>): Promise<T> {
  const db = await openDatabase(descriptor);
  try {
    const transaction = db.transaction(descriptor.store, mode);
    const done = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error(`${descriptor.name} transaction failed.`));
      transaction.onabort = () => reject(transaction.error || new Error(`${descriptor.name} transaction was aborted.`));
    });
    const result = await callback(transaction.objectStore(descriptor.store));
    await done;
    return result;
  } finally {
    db.close();
  }
}

async function setSource(descriptor: DatabaseDescriptor, id: string, source: string | Blob): Promise<void> {
  await withStore(descriptor, "readwrite", async (store) => void (await requestToPromise(store.put(source, id))));
}

async function getSource(descriptor: DatabaseDescriptor, id: string): Promise<unknown> {
  return withStore(descriptor, "readonly", async (store) => requestToPromise(store.get(id)));
}

async function deleteSource(descriptor: DatabaseDescriptor, id: string): Promise<void> {
  await withStore(descriptor, "readwrite", async (store) => void (await requestToPromise(store.delete(id))));
}

export const setImageSource = (id: string, source: string) => setSource(IMAGE_DB, id, source);
export const deleteImageSource = (id: string) => deleteSource(IMAGE_DB, id);
export async function getImageSource(id: string): Promise<string> {
  const value = await getSource(IMAGE_DB, id);
  return typeof value === "string" ? value : "";
}

export const setVideoSource = (id: string, source: string) => setSource(VIDEO_DB, id, source);
export const deleteVideoSource = (id: string) => deleteSource(VIDEO_DB, id);
export async function getVideoSource(id: string): Promise<string> {
  const value = await getSource(VIDEO_DB, id);
  return typeof value === "string" ? value : "";
}

export const setChatFileSource = (id: string, source: Blob) => setSource(CHAT_FILE_DB, id, source);
export const deleteChatFileSource = (id: string) => deleteSource(CHAT_FILE_DB, id);
export async function getChatFileSource(id: string): Promise<Blob | null> {
  const value = await getSource(CHAT_FILE_DB, id);
  return value instanceof Blob ? value : null;
}

export async function urlToDataUrl(url: string): Promise<string> {
  if (!url || url.startsWith("data:")) return url;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch media: HTTP ${response.status}.`);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error || new Error("Failed to convert media to a data URL."));
    reader.readAsDataURL(blob);
  });
}
