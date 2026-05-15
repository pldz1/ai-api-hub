import type { ApiResponse, StorageMode } from "@/services/types";

export const STORAGE_MODE = {
  UNKNOWN: "unknown",
  BROWSER: "browser",
} as const;

/** Attach backend metadata so the UI can display the current storage mode. */
export function withStorageMeta<TData = unknown>(result: ApiResponse<TData>, mode: StorageMode): ApiResponse<TData> {
  if (result && typeof result === "object") {
    return {
      ...result,
      __storageMode: mode,
      __backendMode: mode === STORAGE_MODE.BROWSER ? "mock" : "unknown",
    };
  }
  return result;
}
