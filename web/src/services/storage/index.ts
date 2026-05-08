import store from "@/store";
import { requestBrowserStorage } from "./providers/browser-storage";
import { requestPythonServer, shouldUseBrowserFallback } from "./providers/python-server";
import { STORAGE_MODE, normalizeHostUrl, withStorageMeta } from "./constants";
import type { ApiMethod, ApiResponse, RequestBody, RequestHeaders, StorageMode } from "@/services/types";

let activeStorageMode: StorageMode = STORAGE_MODE.UNKNOWN;
let activeHost: string | null = null;

interface StorageRequest {
  method: ApiMethod;
  endpoint: string;
  body?: RequestBody;
  headers?: RequestHeaders;
  timeout?: number;
}

/**
 * Reset backend detection when the configured companion host changes.
 */
function syncStorageContext(hostUrl: string): void {
  const normalizedHost = normalizeHostUrl(hostUrl);
  if (activeHost !== normalizedHost) {
    activeHost = normalizedHost;
    activeStorageMode = STORAGE_MODE.UNKNOWN;
    store.dispatch("setStorageMode", STORAGE_MODE.UNKNOWN);
  }
}

async function useBrowserStorage<TData = unknown>(endpoint: string, body: RequestBody): Promise<ApiResponse<TData>> {
  activeStorageMode = STORAGE_MODE.BROWSER;
  store.dispatch("setStorageMode", STORAGE_MODE.BROWSER);
  return withStorageMeta(await requestBrowserStorage<TData>(endpoint, body), STORAGE_MODE.BROWSER);
}

/**
 * Storage router.
 *
 * Tries the Python companion service first, remembers the active backend, and
 * falls back to browser storage when the companion service is unavailable.
 */
export async function requestStorage<TData = unknown>({
  method,
  endpoint,
  body = {},
  headers = { "Content-Type": "application/json" },
  timeout = 180000,
}: StorageRequest): Promise<ApiResponse<TData>> {
  const hostUrl = normalizeHostUrl(store.state.hostUrl);
  syncStorageContext(hostUrl);

  if (activeStorageMode === STORAGE_MODE.BROWSER) {
    return useBrowserStorage<TData>(endpoint, body);
  }

  try {
    const result = await requestPythonServer({ method, endpoint, body, headers, timeout, hostUrl });
    activeStorageMode = STORAGE_MODE.SERVER;
    store.dispatch("setStorageMode", STORAGE_MODE.SERVER);
    return withStorageMeta(result as ApiResponse<TData>, STORAGE_MODE.SERVER);
  } catch (error) {
    if (shouldUseBrowserFallback(error)) {
      console.warn(`Python companion unavailable, falling back to browser storage for ${endpoint}.`);
      return useBrowserStorage<TData>(endpoint, body);
    }

    const requestError = error as { code?: string; message?: string };
    if (requestError.code === "ECONNABORTED") {
      console.error("Request timeout!");
    } else {
      console.error(requestError.message);
    }

    return withStorageMeta({ flag: false, log: requestError.message || "Request failed!", data: requestError.message || "Request failed!" } as ApiResponse<TData>, STORAGE_MODE.UNKNOWN);
  }
}
