import type { TokenUsage } from "@/services/types";
import type { ImageModelConfig } from "./model";
import type { ImageParamValue } from "./shared";

export type ImageConversationRole = "user" | "assistant";
export type ImageConversationMode = "generation" | "edit";
export type ImageMessageStatus = "ready" | "loading" | "success" | "error";

export interface ImagePayload {
  id: string;
  src: string;
  filename?: string;
  contentType?: string;
  width?: number;
  height?: number;
}

export interface ImageInputAttachment extends ImageParamValue {
  id: string;
  previewUrl: string;
}

export interface ImageConversationMessage {
  id: string;
  role: ImageConversationRole;
  mode: ImageConversationMode;
  prompt: string;
  images: ImagePayload[];
  attachments?: ImageInputAttachment[];
  status: ImageMessageStatus;
  createdAt: number;
  elapsedMs?: number;
  usage?: TokenUsage | null;
  error?: string;
  modelName?: string;
  size?: string;
}

export interface ImageTurnRequest {
  mode: ImageConversationMode;
  prompt: string;
  model: ImageModelConfig;
  size?: string;
  n?: number;
  quality?: string;
  outputFormat?: string;
  attachments?: ImageInputAttachment[];
}

export interface ImageTurnResponse {
  mode: ImageConversationMode;
  prompt: string;
  images: ImagePayload[];
  usage: TokenUsage;
  raw?: unknown;
}

export interface ImageConversationInfo {
  iid: string;
  iname: string;
}
