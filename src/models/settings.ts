import type { ImageModelConfig, ModelSettings, PersistedModelSettingsPayload } from "@/types";
import type { ChatModelCapabilities, ChatModelConfig } from "@/services/chat/types";
import { type LooseModelConfig, type LooseModelSettings } from "./common";
import { isAzureChatModel, normalizeChatModelConfig } from "./chat";
import { normalizeImageModelConfig } from "./image";

type ChatCapabilityConfigInput = {
  enabledCapabilitiesMode?: "inherit" | "custom";
  enabledCapabilities?: Partial<ChatModelCapabilities>;
};

/** Returns whether the user explicitly saved any chat capability overrides. */
function hasCapabilityOverrides(enabledCapabilities: ChatCapabilityConfigInput["enabledCapabilities"] | null | undefined = {}): boolean {
  return Boolean(enabledCapabilities && Object.keys(enabledCapabilities).length > 0);
}

const modelCapabilityKeys: (keyof ChatModelCapabilities)[] = ["imageRead", "webSearch"];

/**
 * Filters capability override data to the stable chat capability contract.
 *
 * This helper also migrates old `imageInput` data into the current `imageRead`
 * field so user settings remain compatible after schema changes.
 */
export function sanitizeModelCapabilityOverrides(enabledCapabilities: unknown = {}): Partial<ChatModelCapabilities> {
  const source = (enabledCapabilities && typeof enabledCapabilities === "object" ? enabledCapabilities : {}) as Partial<ChatModelCapabilities> & {
    imageInput?: boolean;
  };
  const next: Partial<ChatModelCapabilities> = {};

  modelCapabilityKeys.forEach((key) => {
    if (key === "imageRead") {
      const imageRead = source.imageRead ?? source.imageInput;
      if (typeof imageRead === "boolean") next.imageRead = imageRead;
      return;
    }

    if (typeof source[key] === "boolean") next[key] = source[key];
  });

  return next;
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
    enabledCapabilities: structuredClone(sanitizeModelCapabilityOverrides(model?.enabledCapabilities)),
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
    imageOperation: "generation",
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
  const imageModels = Array.isArray(normalized.image) ? normalized.image : [];

  return {
    chat: (Array.isArray(normalized.chat) ? normalized.chat : []).map((item) => sanitizeChatModelConfig(item as ChatModelConfig)),
    image: imageModels.map((item) => sanitizeImageModelConfig(item as ImageModelConfig)),
  };
}

/**
 * Migrates legacy persisted settings JSON into the current in-memory model shape.
 *
 * This is the main read-path bridge for old exports or older persisted payloads.
 */
export function migratePersistedModelSettings(data: LooseModelSettings | null | undefined = {}): ModelSettings {
  const migrateModelEntries = (items: unknown[] = [], kind = "") =>
    (Array.isArray(items) ? items : []).map((item) => {
      if (kind === "chat") return normalizeChatModelConfig(item as LooseModelConfig);
      if (kind === "image") return normalizeImageModelConfig(item as LooseModelConfig, "generation");
      return item;
    });

  const imageModels = Array.isArray(data?.image) ? data.image : [];

  return sanitizeModelSettings({
    chat: migrateModelEntries(data?.chat, "chat") as ChatModelConfig[],
    image: migrateModelEntries(imageModels, "image") as ImageModelConfig[],
  });
}

/**
 * Builds the persisted chat payload written to storage/export for one model.
 *
 * This function is intentionally the inverse of the loose read/normalize path:
 * it takes current user config and emits only stable persisted fields.
 */
function buildPersistedChatModelConfig(model: LooseModelConfig | ChatModelConfig): ChatModelConfig {
  const modelConfig = normalizeChatModelConfig(model as LooseModelConfig);
  const basePayload = {
    name: modelConfig.name,
    provider: modelConfig.provider,
    apiKey: modelConfig.apiKey,
    model: modelConfig.model,
    ...getPersistedCapabilityFields(modelConfig),
  };

  if (isAzureChatModel(modelConfig)) {
    return {
      ...basePayload,
      provider: "Azure OpenAI",
      endpoint: modelConfig.endpoint,
      deployment: modelConfig.deployment,
      apiVersion: modelConfig.apiVersion,
    };
  }

  return {
    ...basePayload,
    provider: modelConfig.provider,
    baseURL: "baseURL" in modelConfig ? modelConfig.baseURL : "",
  } as ChatModelConfig;
}

/** Builds the persisted image payload written to storage/export for one model. */
function buildPersistedImageModelConfig(model: LooseModelConfig | ImageModelConfig): ImageModelConfig {
  const modelConfig = normalizeImageModelConfig(model as LooseModelConfig, "generation");
  const basePayload = {
    name: modelConfig.name,
    provider: modelConfig.provider,
    apiKey: modelConfig.apiKey,
    model: modelConfig.model,
    imageOperation: modelConfig.imageOperation,
  };

  if (modelConfig.provider === "Azure OpenAI") {
    return {
      ...basePayload,
      provider: "Azure OpenAI",
      endpoint: modelConfig.endpoint,
      deployment: modelConfig.deployment,
      apiVersion: modelConfig.apiVersion,
    };
  }

  return {
    ...basePayload,
    provider: "OpenAI",
    baseURL: modelConfig.baseURL,
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
    image: persistedSettings.image.map((item) => buildPersistedImageModelConfig(item)),
  };
}
