export * from "./model-shared";
export * from "./chat-model";
export * from "./image-model";

import type { ChatModelConfig, ChatModelDraft } from "./chat-model";
import type { ImageModelConfig, ImageModelDraft } from "./image-model";
import type { CapabilityOverrideMode, ImageOperation, ModelCapabilities, ModelProvider } from "./model-shared";

/**
 * Legacy wide draft used by the settings form.
 * Kept temporarily for compatibility while the settings layer is migrated to provider-specific drafts.
 */
export interface ModelFormDraft {
  name: string;
  provider: ModelProvider;
  baseURL: string;
  endpoint: string;
  apiKey: string;
  model: string;
  deployment: string;
  apiVersion: string;
  imageOperation: ImageOperation | "";
  enabledCapabilitiesMode?: CapabilityOverrideMode;
  enabledCapabilities?: Partial<ModelCapabilities>;
}

export type ModelConfig = ChatModelConfig | ImageModelConfig;
export type ProviderBoundModelDraft = ChatModelDraft | ImageModelDraft;

export interface ModelSettings {
  chat: ChatModelConfig[];
  imageGeneration: ImageModelConfig[];
  imageEdit: ImageModelConfig[];
  image: ImageModelConfig[];
  rtaudio: ModelFormDraft[];
}
