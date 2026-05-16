import type { ExportedChatSessionSettings } from "../chat";
import type { ChatProviderPayload } from "../chat/provider";
import type { ImageProviderPayload } from "./provider";

/**
 * Full persisted settings payload written to storage and exported to JSON.
 *
 * This is still user-facing configuration. None of these fields are runtime-only.
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
