import type { ChatModelConfig, ParamDefaultValue, ImageModelConfig, ImageModelParamType, ModelSettings, LooseModelConfig, VideoModelConfig } from "@/types";
import { normalizeChatModelConfig } from "./chat";
import { normalizeImageModelConfig } from "./image";
import { normalizeVideoModelConfig } from "./video";

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
    baseURL: model.baseURL,
    apiKey: model.apiKey,
    model: model.model,
  };
}

/** Same as `sanitizeChatModelConfig`, but for image model payloads. */
function sanitizeImageModelConfig(model: LooseModelConfig | ImageModelConfig): ImageModelConfig {
  const modelConfig = normalizeImageModelConfig(model as LooseModelConfig);
  return {
    name: modelConfig.name,
    provider: modelConfig.provider,
    apiKey: modelConfig.apiKey,
    model: modelConfig.model,
    baseURL: modelConfig.baseURL,
  };
}

/** Same as `sanitizeChatModelConfig`, but for video model payloads. */
function sanitizeVideoModelConfig(model: LooseModelConfig | VideoModelConfig): VideoModelConfig {
  const modelConfig = normalizeVideoModelConfig(model as LooseModelConfig);
  return {
    name: modelConfig.name,
    provider: modelConfig.provider,
    apiKey: modelConfig.apiKey,
    model: modelConfig.model,
    baseURL: modelConfig.baseURL,
    useProxy: modelConfig.useProxy ?? false,
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

  const videoModels = Array.isArray(normalized.video) ? normalized.video : [];

  return {
    chat: (Array.isArray(normalized.chat) ? normalized.chat : []).map((item) => sanitizeChatModelConfig(item as ChatModelConfig)),
    image: imageModels.map((item) => sanitizeImageModelConfig(item as LooseModelConfig)),
    video: videoModels.map((item) => sanitizeVideoModelConfig(item as LooseModelConfig)),
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
    baseURL: modelConfig.baseURL,
    apiKey: modelConfig.apiKey,
    model: modelConfig.model,
  };
  return basePayload;
}

/** Builds the persisted image payload written to storage/export for one model. */
function buildPersistedImageModelConfig(model: LooseModelConfig | ImageModelConfig): ImageModelConfig {
  const modelConfig = normalizeImageModelConfig(model as LooseModelConfig);
  return {
    name: modelConfig.name,
    provider: modelConfig.provider,
    apiKey: modelConfig.apiKey,
    model: modelConfig.model,
    baseURL: modelConfig.baseURL,
  };
}

/** Builds the persisted video payload written to storage/export for one model. */
function buildPersistedVideoModelConfig(model: LooseModelConfig | VideoModelConfig): VideoModelConfig {
  const modelConfig = normalizeVideoModelConfig(model as LooseModelConfig);
  return {
    name: modelConfig.name,
    provider: modelConfig.provider,
    apiKey: modelConfig.apiKey,
    model: modelConfig.model,
    baseURL: modelConfig.baseURL,
    useProxy: modelConfig.useProxy ?? false,
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
    video: persistedSettings.video.map((item) => buildPersistedVideoModelConfig(item)),
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
