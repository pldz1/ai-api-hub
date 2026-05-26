import type { ChatModelConfig } from "@/ai-capability/chat/types";
import type { ImageModelConfig } from "@/ai-capability/image/types";
import type { ExportedChatSessionSettings } from "./conversation";

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
 * Full persisted settings payload written to storage and exported to JSON.
 *
 * This is user-facing I/O configuration. Runtime-only provider args do not
 * belong here.
 */
export interface PersistedModelSettingsPayload {
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
  models: PersistedModelSettingsPayload;
  templates?: unknown[];
  chatSessions?: ExportedChatSessionSettings[];
}
