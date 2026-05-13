import type { ChatModelConfig, ImageModelConfig, ImageOperation, ModelFormDraft, ModelSettings } from "@/types/model";
import { cloneJson, defaultModelFormDraft, getModelRequestId, type LooseModelConfig, type LooseModelSettings } from "./model-common";
import { isAzureChatModel, toRuntimeChatModelConfig } from "./chat-model";
import { toRuntimeImageModelConfig } from "./image-model";

function hasCapabilityOverrides(enabledCapabilities: Partial<ModelFormDraft["enabledCapabilities"]> | null | undefined = {}): boolean {
  return Boolean(enabledCapabilities && Object.keys(enabledCapabilities).length > 0);
}

function getCapabilityOverrideMode(model: Partial<Pick<ModelFormDraft, "enabledCapabilitiesMode" | "enabledCapabilities">> | null | undefined = {}): "inherit" | "custom" {
  if (model?.enabledCapabilitiesMode === "custom") return "custom";
  return hasCapabilityOverrides(model?.enabledCapabilities) ? "custom" : "inherit";
}

function getPersistedCapabilityFields(model: Partial<Pick<ModelFormDraft, "enabledCapabilitiesMode" | "enabledCapabilities">> | null | undefined = {}) {
  if (getCapabilityOverrideMode(model) !== "custom") return {};
  return {
    enabledCapabilitiesMode: "custom" as const,
    enabledCapabilities: cloneJson(model?.enabledCapabilities || {}),
  };
}

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
    ...getPersistedCapabilityFields(model),
  } as ImageModelConfig;
}

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
    rtaudio: (Array.isArray(normalized.rtaudio) ? normalized.rtaudio : []).map((item) => ({
      ...cloneJson(defaultModelFormDraft),
      ...(item && typeof item === "object" ? cloneJson(item) : {}),
    })),
  };
}

/** Migrates legacy persisted model settings into the current persistence schema. */
export function migratePersistedModelSettings(data: LooseModelSettings | null | undefined = {}): ModelSettings {
  const migrateModelEntries = (items: unknown[] = [], kind = "", imageOperation: ImageOperation | "" = "") =>
    (Array.isArray(items) ? items : []).map((item) => {
      if (kind === "chat") return toRuntimeChatModelConfig(item as LooseModelConfig);
      if (kind === "image")
        return toRuntimeImageModelConfig(item as LooseModelConfig, imageOperation || (item as LooseModelConfig)?.imageOperation || "generation");
      const plainItem = item && typeof item === "object" ? item : {};
      return {
        ...cloneJson(defaultModelFormDraft),
        ...plainItem,
      };
    });

  const legacyImageModels = Array.isArray(data?.image) ? data.image : [];
  const imageGenerationModels = Array.isArray(data?.imageGeneration) ? data.imageGeneration : legacyImageModels;
  const imageEditModels = Array.isArray(data?.imageEdit) ? data.imageEdit : legacyImageModels;

  return sanitizeModelSettings({
    chat: migrateModelEntries(data?.chat, "chat") as ChatModelConfig[],
    imageGeneration: migrateModelEntries(imageGenerationModels, "image", "generation") as ImageModelConfig[],
    imageEdit: migrateModelEntries(imageEditModels, "image", "edit") as ImageModelConfig[],
    image: migrateModelEntries(imageGenerationModels, "image", "generation") as ImageModelConfig[],
    rtaudio: migrateModelEntries(data?.rtaudio) as ModelFormDraft[],
  });
}

function buildPersistedChatModelConfig(model: Partial<ModelFormDraft> | ChatModelConfig): Record<string, unknown> {
  const runtimeModel = toRuntimeChatModelConfig(model as LooseModelConfig);
  const payload: Record<string, unknown> = {
    name: runtimeModel.name,
    provider: runtimeModel.provider,
    apiKey: runtimeModel.apiKey,
    model: getModelRequestId(runtimeModel),
  };

  if (isAzureChatModel(runtimeModel)) {
    payload.endpoint = runtimeModel.endpoint;
    payload.deployment = runtimeModel.deployment;
    payload.apiVersion = runtimeModel.apiVersion;
  } else {
    payload.baseURL = "baseURL" in runtimeModel ? runtimeModel.baseURL : "";
  }

  if (hasCapabilityOverrides(runtimeModel.enabledCapabilities)) {
    payload.enabledCapabilitiesMode = "custom";
    payload.enabledCapabilities = cloneJson(runtimeModel.enabledCapabilities);
  } else if (runtimeModel.enabledCapabilitiesMode === "custom") {
    payload.enabledCapabilitiesMode = "custom";
    payload.enabledCapabilities = {};
  }

  return payload;
}

function buildPersistedImageModelConfig(model: Partial<ModelFormDraft> | ImageModelConfig, imageOperation: ImageOperation): Record<string, unknown> {
  const runtimeModel = toRuntimeImageModelConfig(model as LooseModelConfig, imageOperation);
  const payload: Record<string, unknown> = {
    name: runtimeModel.name,
    provider: runtimeModel.provider,
    apiKey: runtimeModel.apiKey,
    model: getModelRequestId(runtimeModel),
  };

  if (runtimeModel.provider === "Azure OpenAI") {
    payload.endpoint = runtimeModel.endpoint;
    payload.deployment = runtimeModel.deployment;
    payload.apiVersion = runtimeModel.apiVersion;
  } else {
    payload.baseURL = runtimeModel.baseURL;
  }

  if (hasCapabilityOverrides(runtimeModel.enabledCapabilities)) {
    payload.enabledCapabilitiesMode = "custom";
    payload.enabledCapabilities = cloneJson(runtimeModel.enabledCapabilities);
  } else if (runtimeModel.enabledCapabilitiesMode === "custom") {
    payload.enabledCapabilitiesMode = "custom";
    payload.enabledCapabilities = {};
  }

  return payload;
}

/** Builds the persistence payload written to storage/export. */
export function buildPersistedModelSettingsPayload(data: LooseModelSettings | null | undefined = {}): Record<string, unknown> {
  const persistedSettings = migratePersistedModelSettings(data);
  const payload: Record<string, unknown> = {
    chat: persistedSettings.chat.map((item) => buildPersistedChatModelConfig(item)),
    imageGeneration: persistedSettings.imageGeneration.map((item) => buildPersistedImageModelConfig(item, "generation")),
    imageEdit: persistedSettings.imageEdit.map((item) => buildPersistedImageModelConfig(item, "edit")),
  };

  if (Array.isArray(persistedSettings.rtaudio) && persistedSettings.rtaudio.length > 0) {
    payload.rtaudio = cloneJson(persistedSettings.rtaudio);
  }

  return payload;
}
