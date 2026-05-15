import store from "@/store";
import { tr } from "@/i18n";
import { requestBrowserStorage } from "./providers/browser-storage";
import { STORAGE_MODE, withStorageMeta } from "./constants";
import type { ApiMethod, ApiResponse, RequestBody, RequestHeaders, StorageMode } from "@/services/types";

let activeStorageMode: StorageMode = STORAGE_MODE.UNKNOWN;

interface StorageRequest {
  method: ApiMethod;
  endpoint: string;
  body?: RequestBody;
  headers?: RequestHeaders;
  timeout?: number;
}

async function useBrowserStorage<TData = unknown>(endpoint: string, body: RequestBody): Promise<ApiResponse<TData>> {
  activeStorageMode = STORAGE_MODE.BROWSER;
  store.dispatch("setStorageMode", STORAGE_MODE.BROWSER);
  return withStorageMeta(await requestBrowserStorage<TData>(endpoint, body), STORAGE_MODE.BROWSER);
}

/**
 * Storage router.
 *
 * Browser storage is the only storage backend in this build.
 */
export async function requestStorage<TData = unknown>({
  method,
  endpoint,
  body = {},
  headers = { "Content-Type": "application/json" },
  timeout = 180000,
}: StorageRequest): Promise<ApiResponse<TData>> {
  if (activeStorageMode === STORAGE_MODE.BROWSER) {
    return useBrowserStorage<TData>(endpoint, body);
  }

  try {
    const result = await requestBrowserStorage<TData>(endpoint, body);
    activeStorageMode = STORAGE_MODE.BROWSER;
    store.dispatch("setStorageMode", STORAGE_MODE.BROWSER);
    return withStorageMeta(result, STORAGE_MODE.BROWSER);
  } catch (error) {
    const requestError = error as { message?: string };
    const fallbackMessage = requestError.message || tr("storage.requestFailed");
    console.error(fallbackMessage);
    return withStorageMeta({ flag: false, log: fallbackMessage, data: fallbackMessage } as ApiResponse<TData>, STORAGE_MODE.UNKNOWN);
  }
}
