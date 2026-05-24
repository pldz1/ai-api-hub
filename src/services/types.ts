import type { ChatMessageRole, ChatModelCapabilities, ImageModelConfig } from "@/types";

export type ApiMethod = "get" | "post" | "put" | "patch" | "delete";
export type RequestBody = Record<string, unknown>;
export type RequestHeaders = Record<string, string>;

export interface ApiResponse<TData = unknown> {
  flag: boolean;
  log: string;
  data: TData;
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  [key: string]: unknown;
}

export interface ChatTextContent {
  type: "text";
  text: string;
}

export interface ChatImageContent {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "low" | "high" | "auto" | string;
  };
}

export type ChatPromptContent = ChatTextContent | ChatImageContent;

export interface ChatPromptMessage {
  role: ChatMessageRole;
  content: ChatPromptContent[];
  mid?: string;
  reasoning_content?: string;
  token_usage?: TokenUsage | null;
  meta?: {
    usedCapabilities?: Partial<ChatModelCapabilities>;
  };
}

export interface PackedTextChatMessage {
  role: ChatMessageRole;
  content: string;
}

export interface PackedPartChatMessage {
  role: ChatMessageRole;
  content: ChatPromptContent[];
}

export type PackedChatMessage = PackedTextChatMessage | PackedPartChatMessage;

export interface ChatProviderResponse {
  flag?: boolean;
  content: string;
  reasoning_content: string;
  usage?: TokenUsage | null;
}

export type ChatCallback = (response: ChatProviderResponse) => void | Promise<void>;

export interface ChatRequestOptions {
  signal?: AbortSignal;
}

export interface ChatListItem {
  cid: string;
  cname: string;
}

export interface StoredChatMessage {
  mid: string;
  message: string;
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

export interface StoredImageConversation {
  iid: string;
  iname: string;
  messages: string;
}

export type ImageParamPrimitive = string | number | boolean | null | undefined;
export type ImageParamValue = ImageParamPrimitive | Record<string, unknown> | unknown[];

export interface ImageGenerationParams {
  prompt: string;
  size?: string;
  n?: number;
  quality?: string;
  outputFormat?: string;
  [key: string]: ImageParamValue;
}

export interface ImageGenerationItem {
  type: "url" | "text";
  data: string;
}

export interface ImageGenerationResult {
  images: ImageGenerationItem[];
  usage: TokenUsage;
  raw?: unknown;
}

export interface ImageRequest {
  url: string;
  headers: RequestHeaders;
  body: RequestBody | FormData;
  isFormData: boolean;
}

export type ImageProviderModel = ImageModelConfig | Partial<ImageModelConfig>;
