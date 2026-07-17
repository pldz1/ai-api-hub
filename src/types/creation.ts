import type { TokenUsage, RunSnapshot, ImageModelProvider, ImageInputFile, ImageModelConfig, VideoModelConfig, VideoInputFile } from "@/ai-capability";

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
  createdAt: number;
  run: RunSnapshot | null;
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

// ============================================================================
// Video conversation types
// ============================================================================

export type VideoConversationRole = "user" | "assistant";
export type VideoMessageStatus = "ready" | "loading" | "success" | "error";

export interface VideoModelSettings {
  model: VideoModelConfig | null;
  prompt: string;
  resolution: string;
  duration: number;
  promptExtend: boolean;
  watermark: boolean;
  first_frame: VideoInputFile | null;
  [key: string]: unknown;
}

export interface VideoPayload {
  id: string;
  src: string;
  filename?: string;
  contentType?: string;
}

export interface VideoInputAttachment extends VideoInputFile {
  id: string;
  previewUrl: string;
}

export interface VideoConversationMessage {
  id: string;
  role: VideoConversationRole;
  prompt: string;
  videos: VideoPayload[];
  attachments?: VideoInputAttachment[];
  createdAt: number;
  run: RunSnapshot | null;
}

export interface VideoTurnRequest {
  prompt: string;
  model: VideoModelConfig;
  resolution?: string;
  duration?: number;
  promptExtend?: boolean;
  watermark?: boolean;
  attachments?: VideoInputAttachment[];
  first_frame?: VideoInputAttachment;
  last_frame?: VideoInputAttachment;
}

export interface VideoTurnResponse {
  prompt: string;
  videos: VideoPayload[];
  usage: TokenUsage;
  raw?: unknown;
}

export interface VideoConversationInfo {
  vid: string;
  vname: string;
}

export interface VideoDataItem {
  id: string;
  prompt: string;
  src: string;
}

export interface VideoConversationListItem {
  vid: string;
  vname: string;
}
