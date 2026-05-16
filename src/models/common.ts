import type { CapabilityOverrideMode, ChatFormProvider, ChatModelCapabilities, ModelParamDef as ChatModelParamDef } from "@/types/chat";
import type { ParamDefaultValue as ChatParamDefaultValue } from "@/types/chat";
import type { ModelSettings } from "@/types/settings";
import type { ImageModelProvider, ImageOperation, ModelParamDef as ImageModelParamDef, ModelParamType, ParamDefaultValue as ImageParamDefaultValue } from "@/types/image";

type WorkspaceParamDefaultValue = ChatParamDefaultValue | ImageParamDefaultValue;

/**
 * Loose parameter definition accepted from legacy config or partially-filled UI data.
 *
 * Normalization helpers turn this into a full `ModelParamDef`.
 */
export type LooseParamDef = Partial<ImageModelParamDef> & { key?: string };
/**
 * Legacy provider fields accepted while migrating older saved payloads.
 *
 * Older data may use `apiType`; newer data should use `provider`.
 */
export type LegacyModelProviderConfig = { apiType?: ChatFormProvider; provider?: ChatFormProvider };
/**
 * Loose model config accepted at compatibility boundaries.
 *
 * Use this type only for parsing/migration/normalization. Once normalized, code
 * should move to provider payload types such as `ChatModelConfig`.
 */
export interface LooseModelConfig extends LegacyModelProviderConfig {
  name?: string;
  provider?: ChatFormProvider | ImageModelProvider | "";
  baseURL?: string;
  endpoint?: string;
  apiKey?: string;
  model?: string;
  modelType?: string;
  deployment?: string;
  apiVersion?: string;
  imageOperation?: ImageOperation | "";
  enabledCapabilitiesMode?: CapabilityOverrideMode;
  enabledCapabilities?: Partial<ChatModelCapabilities>;
  chatParamDefs?: ChatModelParamDef[];
  imageParamDefs?: ImageModelParamDef[];
}
/**
 * Loose top-level model settings payload accepted from storage/import/export.
 *
 * The optional legacy `image` list is preserved here for backward compatibility.
 */
export type LooseModelSettings = Partial<ModelSettings> & {
  image?: unknown[];
};

const modelCapabilityKeys: (keyof ChatModelCapabilities)[] = ["imageRead", "webSearch", "reasoning", "functionCalling"];

/**
 * Deep-clones JSON-compatible config/settings values.
 *
 * This helper is used where model config data is expected to remain plain JSON
 * and structured cloning semantics are enough.
 */
export function cloneJson<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

/**
 * Returns the normalized provider field from loose model data.
 *
 * Accepts both the current `provider` field and the legacy `apiType` field.
 */
export function getLegacyProvider(model: LooseModelConfig | null | undefined = {}): ChatFormProvider {
  return (model?.provider || model?.apiType || "") as ChatFormProvider;
}

/**
 * Returns the normalized model id from loose model data.
 *
 * Accepts both the current `model` field and the legacy `modelType` field.
 */
export function getModelRequestId(model: { model?: string; modelType?: string } | null | undefined): string {
  return String(model?.model || model?.modelType || "").trim();
}

/** Returns the Azure deployment name used when building Azure runtime config. */
export function getModelDeployment(model: { deployment?: string; model?: string; provider?: string } | null | undefined): string {
  return String(model?.deployment || "").trim();
}

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
 * Parses a raw settings value according to a parameter definition type.
 *
 * This is the common coercion layer used by both chat and image settings so the
 * same stored value can be safely interpreted as number/boolean/object/etc.
 */
export function parseParamValue<T = WorkspaceParamDefaultValue>(type: ModelParamType | string = "string", value: unknown = undefined, fallback: T = undefined as T): T {
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

/**
 * Returns whether a normalized parameter value is meaningful enough to include
 * in a provider request payload.
 */
export function hasMeaningfulParamValue(type: ModelParamType | string = "string", value: unknown = undefined): boolean {
  if (value === undefined || value === null) return false;
  if (type === "string" && value === "") return false;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0;
  if (type === "image") return Boolean(value && typeof value === "object" && "filename" in value && "content_type" in value && "data" in value);
  return true;
}
