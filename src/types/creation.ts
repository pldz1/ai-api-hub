import type { TokenUsage, ImageModelProvider, ImageInputFile, ImageModelConfig } from "@/ai-capability";

export type ImageConversationRole = "user" | "assistant";
export type ImageConversationMode = "generation" | "edit";
export type ImageMessageStatus = "ready" | "loading" | "success" | "error";

/**
 * Image-model editor state used by the settings form.
 *
 * This state is image-only and avoids mixing chat-specific capability fields
 * into image model editing.
 */
export interface ImageModelEditorState {
  name: string;
  provider: ImageModelProvider | "";
  baseURL: string;
  apiKey: string;
  model: string;
}

export interface ImageModelSettings {
  model: ImageModelConfig | null;
  prompt: string;
  size: string;
  quality: string;
  image: ImageInputFile | null;
  mask: ImageInputFile | null;
  n: number;
  [key: string]: unknown;
}

export type ImageFormProvider = ImageModelProvider | "";

export interface ImagePayload {
  id: string;
  src: string;
  filename?: string;
  contentType?: string;
  width?: number;
  height?: number;
}

export interface ImageInputAttachment extends ImageInputFile {
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

export interface ImageDataItem {
  id: string;
  prompt: string;
  src: string;
}

export interface ImageConversationListItem {
  iid: string;
  iname: string;
}
