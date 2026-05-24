import type { ChatModelConfig } from "./chat";
import type { ImageModelConfig } from "./image";
import type { ExportedChatSessionSettings } from "./chat";
import type { ChatProviderPayload } from "./chat/provider";
import type { ImageProviderPayload } from "./image/provider";

export type ModelKind = "chat" | "image" | "audio" | "embedding";

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
  imageGeneration: ImageModelConfig[];
  imageEdit: ImageModelConfig[];
  image: ImageModelConfig[];
}

/**
 * Full persisted settings payload written to storage and exported to JSON.
 *
 * This is user-facing I/O configuration. Runtime-only provider args do not
 * belong here.
 */
export interface PersistedModelSettingsPayload {
  chat: ChatProviderPayload[];
  imageGeneration: ImageProviderPayload[];
  imageEdit: ImageProviderPayload[];
  image?: ImageProviderPayload[];
}

/**
 * Top-level import/export package used by the settings page.
 */
export interface SettingsImportPayload {
  schema?: string;
  version?: string;
  exportedAt?: string;
  models: PersistedModelSettingsPayload;
  templates?: unknown[];
  chatSessions?: ExportedChatSessionSettings[];
}
