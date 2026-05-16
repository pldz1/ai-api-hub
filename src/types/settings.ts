import type { ChatModelConfig } from "./chat";
import type { ImageModelConfig } from "./image";

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
