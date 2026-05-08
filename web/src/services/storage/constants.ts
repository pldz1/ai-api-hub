import type { ApiResponse, StorageMode } from "@/services/types";

export const STORAGE_MODE = {
  UNKNOWN: "unknown",
  SERVER: "server",
  BROWSER: "browser",
} as const;

/** Normalize user-configured companion service host before backend detection. */
export function normalizeHostUrl(hostUrl: string | null | undefined): string {
  return hostUrl || "";
}

/** Attach backend metadata so the UI can display the current storage mode. */
export function withStorageMeta<TData = unknown>(result: ApiResponse<TData>, mode: StorageMode): ApiResponse<TData> {
  if (result && typeof result === "object") {
    return {
      ...result,
      __storageMode: mode,
      __backendMode: mode === STORAGE_MODE.SERVER ? "remote" : mode === STORAGE_MODE.BROWSER ? "mock" : "unknown",
    };
  }
  return result;
}
