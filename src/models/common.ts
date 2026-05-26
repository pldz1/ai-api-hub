import type {
  CapabilityOverrideMode,
  ChatFormProvider,
  ModelSettings,
  ImageModelProvider,
  ImageOperation,
  ImageModelParamDef,
  ImageModelParamType,
  ImageParamDefaultValue,
} from "@/types";
import type { ChatModelCapabilities } from "@/ai-capability/chat/types";
import type { ModelParamDef, ParamDefaultValue } from "@/ai-capability/chat/types";

type WorkspaceParamDefaultValue = ParamDefaultValue | ImageParamDefaultValue;

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
  chatParamDefs?: ModelParamDef[];
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

/**
 * Parses a raw settings value according to a parameter definition type.
 *
 * This is the common coercion layer used by both chat and image settings so the
 * same stored value can be safely interpreted as number/boolean/object/etc.
 */
export function parseParamValue<T = WorkspaceParamDefaultValue>(
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
