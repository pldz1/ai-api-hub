import type { ImageModelConfig, ImageModelSettings, ImageOperation, ImageModelParamDef, ImageModelParamType } from "@/types";
import { imageParamPresetList } from "@/constants/image-model";
import { parseParamValue, type LooseModelConfig, type LooseParamDef } from "./common";

const defaultImageModelSettings = {
  model: null,
  prompt: "",
  size: "1024x1024",
  quality: "",
  mask: null,
  image: null,
  n: 1,
} satisfies ImageModelSettings;

/** Returns the built-in preset definition for one image parameter key. */
function getImageParamPreset(key = ""): LooseParamDef | null {
  return imageParamPresetList.find((item) => item.key === key) || null;
}

/**
 * Returns whether a normalized parameter value is meaningful enough to include
 * in a provider request payload.
 */
export function hasMeaningfulParamValue(type: ImageModelParamType | string = "string", value: unknown = undefined): boolean {
  if (value === undefined || value === null) return false;
  if (type === "string" && value === "") return false;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0;
  if (type === "image") return Boolean(value && typeof value === "object" && "filename" in value && "content_type" in value && "data" in value);
  return true;
}

/** Returns whether a user image model config should use Azure OpenAI routing. */
export function isAzureImageModel(model: LooseModelConfig | null | undefined): model is LooseModelConfig & { provider: "Azure OpenAI" } {
  return model?.provider === "Azure OpenAI";
}

/**
 * Normalizes loose/legacy image model data into the canonical user config shape.
 *
 * Like `normalizeChatModelConfig`, this still returns user configuration rather
 * than low-level HTTP/runtime request args.
 */
export function normalizeImageModelConfig(model: LooseModelConfig | null | undefined = {}, imageOperation: ImageOperation = "generation"): ImageModelConfig {
  const data = model || {};
  const provider = model?.provider === "Azure OpenAI" ? "Azure OpenAI" : "OpenAI";
  const modelId = data.model;

  if (provider === "Azure OpenAI") {
    return {
      name: String(data.name || "").trim(),
      provider,
      endpoint: String(data.endpoint || "").trim(),
      deployment: String(data.deployment || "").trim(),
      apiVersion: String(data.apiVersion || "").trim(),
      apiKey: String(data.apiKey || "").trim(),
      model: modelId,
      imageOperation,
    };
  }

  return {
    name: String(data.name || "").trim(),
    provider,
    baseURL: String(data.baseURL || "").trim(),
    apiKey: String(data.apiKey || "").trim(),
    model: modelId,
    imageOperation,
  };
}

/** Merges a raw image parameter definition with the built-in preset defaults. */
export function normalizeImageParamDef(def: LooseParamDef = {}): ImageModelParamDef {
  const preset = getImageParamPreset(def.key);
  const nextType = def.type || preset?.type || "string";
  const fallbackDefaultValue = Object.prototype.hasOwnProperty.call(preset || {}, "defaultValue") ? structuredClone(preset.defaultValue) : "";
  const nextDefaultValue = parseParamValue(nextType, def.defaultValue, fallbackDefaultValue);

  return {
    key: String(def.key || preset?.key || "").trim(),
    label: String(def.label || preset?.label || def.key || "").trim(),
    type: nextType,
    description: String(def.description || preset?.description || "").trim(),
    descriptionKey: String(def.descriptionKey || preset?.descriptionKey || "").trim(),
    placeholder: String(def.placeholder || preset?.placeholder || "").trim(),
    defaultValue: nextDefaultValue,
    min: parseParamValue("number", def.min, preset?.min ?? 0),
    max: parseParamValue("number", def.max, preset?.max ?? 1),
    step: parseParamValue("number", def.step, preset?.step ?? 1),
  };
}

/** Returns default parameter definitions for image generation models. */
export function getDefaultImageParamDefs(): ImageModelParamDef[] {
  return ["quality", "output_format"].map((key) => normalizeImageParamDef({ key }));
}

/** Returns default parameter definitions for image edit models. */
export function getDefaultImageEditParamDefs(): ImageModelParamDef[] {
  return ["quality", "output_format", "image", "mask"].map((key) => normalizeImageParamDef({ key }));
}

/**
 * Returns normalized parameter definitions for a configured image model.
 *
 * Edit models are guaranteed to include image-edit specific parameters such as
 * `image` and `mask`.
 */
export function getModelImageParamDefs(model: LooseModelConfig = {}): ImageModelParamDef[] {
  const defaultDefs = getDefaultImageEditParamDefs();
  const supportedKeys = new Set(imageParamPresetList.map((item) => item.key).filter(Boolean));
  const configuredDefs =
    Array.isArray(model?.imageParamDefs) && model.imageParamDefs.length > 0
      ? model.imageParamDefs.filter((item) => item.key && supportedKeys.has(item.key))
      : defaultDefs;
  const defs = [...configuredDefs, ...getDefaultImageEditParamDefs().filter((defaultDef) => !configuredDefs.some((item) => item.key === defaultDef.key))];
  const seen = new Set();

  return defs.map((item) => normalizeImageParamDef(item)).filter((item) => item.key && !seen.has(item.key) && (seen.add(item.key), true));
}

/**
 * Builds the initial settings object for an image model from its resolved
 * parameter definitions.
 */
export function buildDefaultImageSettings(model: LooseModelConfig | null = null): ImageModelSettings {
  const settings = structuredClone(defaultImageModelSettings);
  const defs = getModelImageParamDefs(model || {});

  defs.forEach((item) => {
    settings[item.key] = structuredClone(item.defaultValue);
  });

  return settings;
}

/**
 * Merges saved image settings with defaults derived from the active image model.
 */
export function mergeImageSettingsWithModel(model: LooseModelConfig | null = null, settings: Partial<ImageModelSettings> = {}): ImageModelSettings {
  const coreSettings: Partial<ImageModelSettings> = {
    model: settings.model ?? null,
    prompt: typeof settings.prompt === "string" ? settings.prompt : defaultImageModelSettings.prompt,
    size: typeof settings.size === "string" && settings.size ? settings.size : defaultImageModelSettings.size,
    image: settings.image ?? null,
    mask: settings.mask ?? null,
    n: settings.n ?? defaultImageModelSettings.n,
  };
  const mergedSettings = {
    ...buildDefaultImageSettings(model),
    ...coreSettings,
  };

  const defs = getModelImageParamDefs(model || {});
  defs.forEach((item) => {
    mergedSettings[item.key] = parseParamValue(item.type, mergedSettings[item.key], structuredClone(item.defaultValue));
  });

  if (!Number.isFinite(Number(mergedSettings.n)) || Number(mergedSettings.n) < 1) {
    mergedSettings.n = defaultImageModelSettings.n;
  } else {
    mergedSettings.n = Number(mergedSettings.n);
  }

  return mergedSettings;
}

/**
 * Builds provider request params from user image settings.
 *
 * This is the image-side boundary where user settings become runtime request
 * body fields.
 */
export function buildImageGenerationParams(model: LooseModelConfig | null = null, settings: Partial<ImageModelSettings> = {}): Record<string, unknown> {
  const defs = getModelImageParamDefs(model || {});
  const mergedSettings = mergeImageSettingsWithModel(model, settings);
  const params: Record<string, unknown> = {};

  defs.forEach((item) => {
    const value = parseParamValue(item.type, mergedSettings[item.key], structuredClone(item.defaultValue));
    if (!hasMeaningfulParamValue(item.type, value)) return;
    params[item.key] = value;
  });

  return params;
}
