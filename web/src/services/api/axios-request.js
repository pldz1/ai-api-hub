import { requestStorage } from "@/services/storage";

const LONGTIME = 180000;

/** 调用本地 companion service 或浏览器存储 provider 的统一入口 */
export async function apiRequest(method, endpoint, body = {}, headers = { "Content-Type": "application/json" }, timeout = LONGTIME) {
  return requestStorage({ method, endpoint, body, headers, timeout });
}
