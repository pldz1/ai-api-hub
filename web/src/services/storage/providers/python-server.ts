import axios from "axios";
import type { ApiMethod, ApiResponse, RequestBody, RequestHeaders } from "@/services/types";

interface PythonServerRequest {
  method: ApiMethod;
  endpoint: string;
  body: RequestBody;
  headers: RequestHeaders;
  timeout: number;
  hostUrl: string;
}

export function shouldUseBrowserFallback(error: { response?: { status?: number } } | null | undefined): boolean {
  if (!error?.response) return true;
  return [404, 405, 501, 502, 503, 504].includes(Number(error.response.status));
}

export async function requestPythonServer({ method, endpoint, body, headers, timeout, hostUrl }: PythonServerRequest): Promise<ApiResponse> {
  const response = await axios({
    method,
    url: `${hostUrl + endpoint}`,
    data: body,
    headers,
    timeout,
    withCredentials: true,
  });

  return response.data;
}
