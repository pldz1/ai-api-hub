export const STORAGE_MODE = {
  UNKNOWN: "unknown",
  SERVER: "server",
  BROWSER: "browser",
};

export function normalizeHostUrl(hostUrl) {
  return hostUrl || "";
}

export function withStorageMeta(result, mode) {
  if (result && typeof result === "object") {
    return {
      ...result,
      __storageMode: mode,
      __backendMode: mode === STORAGE_MODE.SERVER ? "remote" : mode === STORAGE_MODE.BROWSER ? "mock" : "unknown",
    };
  }
  return result;
}
