import store from "@/store";
import { requestBrowserStorage } from "./providers/browser-storage.js";
import { requestPythonServer, shouldUseBrowserFallback } from "./providers/python-server.js";
import { STORAGE_MODE, normalizeHostUrl, withStorageMeta } from "./constants.js";

let activeStorageMode = STORAGE_MODE.UNKNOWN;
let activeHost = null;

function syncStorageContext(hostUrl) {
  const normalizedHost = normalizeHostUrl(hostUrl);
  if (activeHost !== normalizedHost) {
    activeHost = normalizedHost;
    activeStorageMode = STORAGE_MODE.UNKNOWN;
    store.dispatch("setStorageMode", STORAGE_MODE.UNKNOWN);
  }
}

async function useBrowserStorage(endpoint, body) {
  activeStorageMode = STORAGE_MODE.BROWSER;
  store.dispatch("setStorageMode", STORAGE_MODE.BROWSER);
  return withStorageMeta(await requestBrowserStorage(endpoint, body), STORAGE_MODE.BROWSER);
}

export async function requestStorage({ method, endpoint, body = {}, headers = { "Content-Type": "application/json" }, timeout = 180000 }) {
  const hostUrl = normalizeHostUrl(store.state.hostUrl);
  syncStorageContext(hostUrl);

  if (activeStorageMode === STORAGE_MODE.BROWSER) {
    return useBrowserStorage(endpoint, body);
  }

  try {
    const result = await requestPythonServer({ method, endpoint, body, headers, timeout, hostUrl });
    activeStorageMode = STORAGE_MODE.SERVER;
    store.dispatch("setStorageMode", STORAGE_MODE.SERVER);
    return withStorageMeta(result, STORAGE_MODE.SERVER);
  } catch (error) {
    if (shouldUseBrowserFallback(error)) {
      console.warn(`Python companion unavailable, falling back to browser storage for ${endpoint}.`);
      return useBrowserStorage(endpoint, body);
    }

    if (error.code === "ECONNABORTED") {
      console.error("Request timeout!");
    } else {
      console.error(error.message);
    }

    return withStorageMeta({ data: error.message || "Request failed!" }, STORAGE_MODE.UNKNOWN);
  }
}
