import type { ImageModelConfig, ImageModelProvider, ChatModelConfig } from "@/ai-capability";
import type { ChatFormProvider } from "./conversation";

export type ModelKind = "chat" | "image";

/** Union of canonical user-owned model configs used by the application. */
export type ModelConfig = ChatModelConfig | ImageModelConfig;

/**
 * Full in-memory workspace model settings.
 *
 * These arrays are normalized user config kept in store, not runtime provider
 * constructor args.
 */
export interface ModelSettings {
  chat: ChatModelConfig[];
  image: ImageModelConfig[];
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
 * Loose model config accepted at compatibility boundaries.
 *
 * Use this type only for parsing/migration/normalization. Once normalized, code
 * should move to provider payload types such as `ChatModelConfig`.
 */
export interface LooseModelConfig {
  name?: string;
  provider?: ChatFormProvider | ImageModelProvider | "";
  baseURL?: string;
  endpoint?: string;
  apiKey?: string;
  model?: string;
  modelType?: string;
  deployment?: string;
  apiVersion?: string;
}
