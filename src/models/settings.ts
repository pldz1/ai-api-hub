import type {
  ImageModelConfig,
  ImageOperation,
  ImageProviderPayload,
  PersistedModelSettingsPayload,
} from "@/types/image";
import type { ChatModelCapabilities, ChatModelConfig, ChatProviderPayload } from "@/types/chat";
import type { ModelSettings } from "@/types/settings";
import { cloneJson, getModelRequestId, sanitizeModelCapabilityOverrides, type LooseModelConfig, type LooseModelSettings } from "./common";
import { isAzureChatModel, toRuntimeChatModelConfig } from "./chat";
import { toRuntimeImageModelConfig } from "./image";

type ChatCapabilityConfigInput = {
  enabledCapabilitiesMode?: "inherit" | "custom";
  enabledCapabilities?: Partial<ChatModelCapabilities>;
};

/** Returns whether the user explicitly saved any chat capability overrides. */
function hasCapabilityOverrides(enabledCapabilities: ChatCapabilityConfigInput["enabledCapabilities"] | null | undefined = {}): boolean {
  return Boolean(enabledCapabilities && Object.keys(enabledCapabilities).length > 0);
}

/**
 * Resolves the persisted capability override mode from loose settings data.
 *
 * Older data may omit `enabledCapabilitiesMode` and only persist the flags
 * themselves, so this helper normalizes both cases.
 */
function getCapabilityOverrideMode(model: ChatCapabilityConfigInput | null | undefined = {}): "inherit" | "custom" {
  if (model?.enabledCapabilitiesMode === "custom") return "custom";
  return hasCapabilityOverrides(model?.enabledCapabilities) ? "custom" : "inherit";
}

/**
 * Builds the persisted capability override fields for a chat model payload.
 *
 * These fields are user configuration and should be stored/exported, unlike
 * runtime capability resolution results.
 */
function getPersistedCapabilityFields(model: ChatCapabilityConfigInput | null | undefined = {}) {
  if (getCapabilityOverrideMode(model) !== "custom") return {};
  return {
    enabledCapabilitiesMode: "custom" as const,
    enabledCapabilities: cloneJson(sanitizeModelCapabilityOverrides(model?.enabledCapabilities)),
  };
}

/**
 * Sanitizes a chat model config before putting it back into store/export shape.
 *
 * This removes any transient extras and keeps only the persisted user-facing
 * fields for the selected provider.
 */
function sanitizeChatModelConfig(model: ChatModelConfig): ChatModelConfig {
  return {
    name: model.name,
    provider: model.provider,
    apiKey: model.apiKey,
    model: model.model,
    ...("baseURL" in model ? { baseURL: model.baseURL } : {}),
    ...("endpoint" in model ? { endpoint: model.endpoint } : {}),
    ...("deployment" in model ? { deployment: model.deployment } : {}),
    ...("apiVersion" in model ? { apiVersion: model.apiVersion } : {}),
    ...getPersistedCapabilityFields(model),
  } as ChatModelConfig;
}

/** Same as `sanitizeChatModelConfig`, but for image model payloads. */
function sanitizeImageModelConfig(model: ImageModelConfig): ImageModelConfig {
  return {
    name: model.name,
    provider: model.provider,
    apiKey: model.apiKey,
    model: model.model,
    imageOperation: model.imageOperation,
    ...("baseURL" in model ? { baseURL: model.baseURL } : {}),
    ...("endpoint" in model ? { endpoint: model.endpoint } : {}),
    ...("deployment" in model ? { deployment: model.deployment } : {}),
    ...("apiVersion" in model ? { apiVersion: model.apiVersion } : {}),
  } as ImageModelConfig;
}

/**
 * Normalizes model settings into the canonical in-memory user config shape.
 *
 * Use this when reading possibly-loose data into the store. The result is still
 * user configuration, not runtime provider arguments.
 */
export function sanitizeModelSettings(data: Partial<ModelSettings> | null | undefined = {}): ModelSettings {
  const normalized = data || {};
  const legacyImageModels = Array.isArray(normalized.image) ? normalized.image : [];
  const imageGenerationModels = Array.isArray(normalized.imageGeneration) ? normalized.imageGeneration : legacyImageModels;
  const imageEditModels = Array.isArray(normalized.imageEdit) ? normalized.imageEdit : legacyImageModels;

  return {
    chat: (Array.isArray(normalized.chat) ? normalized.chat : []).map((item) => sanitizeChatModelConfig(item as ChatModelConfig)),
    imageGeneration: (Array.isArray(imageGenerationModels) ? imageGenerationModels : []).map((item) => sanitizeImageModelConfig(item as ImageModelConfig)),
    imageEdit: (Array.isArray(imageEditModels) ? imageEditModels : []).map((item) => sanitizeImageModelConfig(item as ImageModelConfig)),
    image: (Array.isArray(imageGenerationModels) ? imageGenerationModels : []).map((item) => sanitizeImageModelConfig(item as ImageModelConfig)),
  };
}

/**
 * Migrates legacy persisted settings JSON into the current in-memory model shape.
 *
 * This is the main read-path bridge for old exports or older persisted payloads.
 */
export function migratePersistedModelSettings(data: LooseModelSettings | null | undefined = {}): ModelSettings {
  const migrateModelEntries = (items: unknown[] = [], kind = "", imageOperation: ImageOperation | "" = "") =>
    (Array.isArray(items) ? items : []).map((item) => {
      if (kind === "chat") return toRuntimeChatModelConfig(item as LooseModelConfig);
      if (kind === "image")
        return toRuntimeImageModelConfig(item as LooseModelConfig, imageOperation || (item as LooseModelConfig)?.imageOperation || "generation");
      return item;
    });

  const legacyImageModels = Array.isArray(data?.image) ? data.image : [];
  const imageGenerationModels = Array.isArray(data?.imageGeneration) ? data.imageGeneration : legacyImageModels;
  const imageEditModels = Array.isArray(data?.imageEdit) ? data.imageEdit : legacyImageModels;

  return sanitizeModelSettings({
    chat: migrateModelEntries(data?.chat, "chat") as ChatModelConfig[],
    imageGeneration: migrateModelEntries(imageGenerationModels, "image", "generation") as ImageModelConfig[],
    imageEdit: migrateModelEntries(imageEditModels, "image", "edit") as ImageModelConfig[],
    image: migrateModelEntries(imageGenerationModels, "image", "generation") as ImageModelConfig[],
  });
}

/**
 * Builds the persisted chat payload written to storage/export for one model.
 *
 * This function is intentionally the inverse of the loose read/normalize path:
 * it takes current user config and emits only stable persisted fields.
 */
function buildPersistedChatModelConfig(model: LooseModelConfig | ChatModelConfig): ChatProviderPayload {
  const runtimeModel = toRuntimeChatModelConfig(model as LooseModelConfig);
  const basePayload = {
    name: runtimeModel.name,
    provider: runtimeModel.provider,
    apiKey: runtimeModel.apiKey,
    model: getModelRequestId(runtimeModel),
    ...getPersistedCapabilityFields(runtimeModel),
  };

  if (isAzureChatModel(runtimeModel)) {
    return {
      ...basePayload,
      provider: "Azure OpenAI",
      endpoint: runtimeModel.endpoint,
      deployment: runtimeModel.deployment,
      apiVersion: runtimeModel.apiVersion,
    };
  }

  return {
    ...basePayload,
    provider: runtimeModel.provider,
    baseURL: "baseURL" in runtimeModel ? runtimeModel.baseURL : "",
  } as ChatProviderPayload;
}

/** Builds the persisted image payload written to storage/export for one model. */
function buildPersistedImageModelConfig(model: LooseModelConfig | ImageModelConfig, imageOperation: ImageOperation): ImageProviderPayload {
  const runtimeModel = toRuntimeImageModelConfig(model as LooseModelConfig, imageOperation);
  const basePayload = {
    name: runtimeModel.name,
    provider: runtimeModel.provider,
    apiKey: runtimeModel.apiKey,
    model: getModelRequestId(runtimeModel),
    imageOperation: runtimeModel.imageOperation,
  };

  if (runtimeModel.provider === "Azure OpenAI") {
    return {
      ...basePayload,
      provider: "Azure OpenAI",
      endpoint: runtimeModel.endpoint,
      deployment: runtimeModel.deployment,
      apiVersion: runtimeModel.apiVersion,
    };
  }

  return {
    ...basePayload,
    provider: "OpenAI",
    baseURL: runtimeModel.baseURL,
  };
}

/**
 * Builds the top-level persisted model payload written to local storage and
 * settings export JSON.
 *
 * This is the write-side boundary between in-memory user config and serialized
 * persisted settings.
 */
export function buildPersistedModelSettingsPayload(data: LooseModelSettings | null | undefined = {}): PersistedModelSettingsPayload {
  const persistedSettings = migratePersistedModelSettings(data);
  return {
    chat: persistedSettings.chat.map((item) => buildPersistedChatModelConfig(item)),
    imageGeneration: persistedSettings.imageGeneration.map((item) => buildPersistedImageModelConfig(item, "generation")),
    imageEdit: persistedSettings.imageEdit.map((item) => buildPersistedImageModelConfig(item, "edit")),
  };
}
