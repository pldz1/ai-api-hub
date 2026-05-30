import type { ChatModelConfig, ParamDefaultValue, ImageModelConfig, ImageModelParamType, ModelSettings, LooseModelConfig } from "@/types";
import { isAzureChatModel, normalizeChatModelConfig } from "./chat";
import { normalizeImageModelConfig } from "./image";

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
  } as ChatModelConfig;
}

/** Same as `sanitizeChatModelConfig`, but for image model payloads. */
function sanitizeImageModelConfig(model: LooseModelConfig | ImageModelConfig): ImageModelConfig {
  const modelConfig = normalizeImageModelConfig(model as LooseModelConfig);
  return {
    name: modelConfig.name,
    provider: "OpenAI",
    apiKey: modelConfig.apiKey,
    model: modelConfig.model,
    baseURL: modelConfig.baseURL,
  };
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
    image: imageModels.map((item) => sanitizeImageModelConfig(item as LooseModelConfig)),
  };
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
  const modelConfig = normalizeImageModelConfig(model as LooseModelConfig);
  return {
    name: modelConfig.name,
    provider: "OpenAI",
    apiKey: modelConfig.apiKey,
    model: modelConfig.model,
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
export function buildModelSettings(data: Partial<ModelSettings> | null | undefined = {}): ModelSettings {
  const persistedSettings = sanitizeModelSettings(data);
  return {
    chat: persistedSettings.chat.map((item) => buildPersistedChatModelConfig(item)),
    image: persistedSettings.image.map((item) => buildPersistedImageModelConfig(item)),
  };
}

/**
 * Parses a raw settings value according to a parameter definition type.
 *
 * This is the common coercion layer used by both chat and image settings so the
 * same stored value can be safely interpreted as number/boolean/object/etc.
 */
export function parseParamValue<T = ParamDefaultValue>(
  type: ImageModelParamType | string = "string",
  value: unknown = undefined,
  fallback: T = undefined as T,
): T {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (type === "number") {
    const nextValue = Number(value);
    return (Number.isFinite(nextValue) ? nextValue : fallback) as T;
  }

  if (type === "boolean") {
    if (typeof value === "boolean") return value as T;
    if (value === "true") return true as T;
    if (value === "false") return false as T;
    return fallback;
  }

  if (type === "array") {
    if (Array.isArray(value)) return value as T;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return (Array.isArray(parsed) ? parsed : fallback) as T;
      } catch {
        return fallback;
      }
    }
    return fallback;
  }

  if (type === "object") {
    if (value && typeof value === "object" && !Array.isArray(value)) return value as T;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return (parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : fallback) as T;
      } catch {
        return fallback;
      }
    }
    return fallback;
  }

  if (type === "image") {
    if (value && typeof value === "object" && !Array.isArray(value) && "filename" in value && "content_type" in value && "data" in value) return value as T;
    return fallback;
  }

  return String(value) as T;
}
