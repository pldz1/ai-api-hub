import type { ImageModelConfig, ImageModelProvider, ChatModelConfig, VideoModelConfig, VideoModelProvider } from "@/ai-capability";
import type { ChatFormProvider } from "./conversation";

export type ModelKind = "chat" | "image" | "video";

/** Union of canonical user-owned model configs used by the application. */
export type ModelConfig = ChatModelConfig | ImageModelConfig | VideoModelConfig;

/**
 * Full in-memory workspace model settings.
 *
 * These arrays are normalized user config kept in store, not runtime provider
 * constructor args.
 */
export interface ModelSettings {
  chat: ChatModelConfig[];
  image: ImageModelConfig[];
  video: VideoModelConfig[];
}

/**
 * Top-level import/export package used by the settings page.
 */
export interface SettingsImportPayload {
  schema?: string;
  version?: string;
  exportedAt?: string;
  models: ModelSettings;
  templates?: unknown[];
}

/**
 * Loose model config accepted at import and form boundaries.
 *
 * Use this type only for parsing/normalization. Once normalized, code should
 * move to provider payload types such as `ChatModelConfig`.
 */
export interface LooseModelConfig {
  name?: string;
  provider?: ChatFormProvider | ImageModelProvider | VideoModelProvider | "";
  baseURL?: string;
  apiKey?: string;
  model?: string;
  modelType?: string;
  useProxy?: boolean;
}
