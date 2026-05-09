import { requestStorage } from "@/services/storage";
import type { ApiMethod, ApiResponse, RequestBody, RequestHeaders } from "@/services/types";

const LONGTIME = 3600000;

/**
 * Service-layer transport adapter.
 *
 * Feature services call this function instead of choosing a backend directly.
 * `requestStorage` decides whether the request goes to the Python companion
 * service or to the browser-storage fallback.
 */
export async function apiRequest<TData = unknown>(
  method: ApiMethod,
  endpoint: string,
  body: RequestBody = {},
  headers: RequestHeaders = { "Content-Type": "application/json" },
  timeout: number = LONGTIME,
): Promise<ApiResponse<TData>> {
  return requestStorage<TData>({ method, endpoint, body, headers, timeout });
}
