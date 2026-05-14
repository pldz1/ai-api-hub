import { defaultModelFormDraft } from "@/constants/model-common";
import type { ChatModelCapabilities, ModelFormDraft, ModelParamDef, ModelParamType, ModelProvider, ModelSettings, ParamDefaultValue } from "@/types/model";

export type LooseParamDef = Partial<ModelParamDef> & { key?: string };
export type LegacyModelProviderConfig = { apiType?: ModelProvider; provider?: ModelProvider };
export type LooseModelConfig = Partial<ModelFormDraft> &
  LegacyModelProviderConfig & {
    modelType?: string;
    chatParamDefs?: ModelParamDef[];
    imageParamDefs?: ModelParamDef[];
  };
export type LooseModelSettings = Partial<ModelSettings> & {
  image?: unknown[];
};

const modelCapabilityKeys: (keyof ChatModelCapabilities)[] = ["imageRead", "webSearch", "reasoning", "functionCalling"];

/** Deep-clones JSON-compatible model config and settings values. */
export function cloneJson<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

/** Returns the provider, accepting the old `apiType` field from legacy config. */
export function getLegacyProvider(model: LooseModelConfig | null | undefined = {}): ModelProvider {
  return (model?.provider || model?.apiType || "") as ModelProvider;
}

/** Returns the real model id, reading legacy `modelType` when old config data is loaded. */
export function getModelRequestId(model: (Partial<ModelFormDraft> & { modelType?: string }) | null | undefined): string {
  return String(model?.model || model?.modelType || "").trim();
}

/** Returns the Azure deployment name used as the provider request target. */
export function getModelDeployment(model: Partial<ModelFormDraft> | null | undefined): string {
  return String(model?.deployment || "").trim();
}

/** Filters persisted chat capability overrides to the stable chat contract shape. */
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

/** Normalizes common model form fields and migrates legacy provider/model names. */
export function normalizeModelFormDraft(model: LooseModelConfig | null | undefined = {}): ModelFormDraft {
  const data = model || {};
  const { modelType: _legacyModel, apiType: _legacyProvider, ...plainData } = data;
  return {
    ...cloneJson(defaultModelFormDraft),
    ...plainData,
    model: getModelRequestId(data),
    provider: getLegacyProvider(data),
    enabledCapabilities: sanitizeModelCapabilityOverrides(data.enabledCapabilities),
  };
}

/** Parses a raw setting value according to a model parameter definition type. */
export function parseParamValue<T = ParamDefaultValue>(type: ModelParamType | string = "string", value: unknown = undefined, fallback: T = undefined as T): T {
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

/** Returns whether a parsed parameter value should be sent to a provider. */
export function hasMeaningfulParamValue(type: ModelParamType | string = "string", value: unknown = undefined): boolean {
  if (value === undefined || value === null) return false;
  if (type === "string" && value === "") return false;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0;
  if (type === "image") return Boolean(value && typeof value === "object" && "filename" in value && "content_type" in value && "data" in value);
  return true;
}
