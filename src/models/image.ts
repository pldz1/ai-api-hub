import type { ImageModelConfig, ImageModelSettings, ImageModelParamDef, ImageModelParamType, LooseModelConfig } from "@/types";
import { imageParamPresetList } from "@/constants/image-model";
import { parseParamValue } from "./settings";

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
function getImageParamPreset(key = ""): Partial<ImageModelParamDef> | null {
  return imageParamPresetList.find((item) => item.key === key) || null;
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
export function normalizeImageModelConfig(model: LooseModelConfig | null | undefined = {}): ImageModelConfig {
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
    };
  }

  return {
    name: String(data.name || "").trim(),
    provider,
    baseURL: String(data.baseURL || "").trim(),
    apiKey: String(data.apiKey || "").trim(),
    model: modelId,
  };
}

/** Merges a raw image parameter definition with the built-in preset defaults. */
export function normalizeImageParamDef(def: Partial<ImageModelParamDef> = {}): ImageModelParamDef {
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

export const imageParamDefs: ImageModelParamDef[] = ["quality", "output_format", "image", "mask"].map((key) => normalizeImageParamDef({ key }));

function mergeResolvedImageSettings(defs: ImageModelParamDef[], settings: Partial<ImageModelSettings> = {}): ImageModelSettings {
  const mergedSettings: ImageModelSettings = {
    ...structuredClone(defaultImageModelSettings),
    model: settings.model ?? null,
    prompt: typeof settings.prompt === "string" ? settings.prompt : defaultImageModelSettings.prompt,
    size: typeof settings.size === "string" && settings.size ? settings.size : defaultImageModelSettings.size,
    image: settings.image ?? null,
    mask: settings.mask ?? null,
    n: settings.n ?? defaultImageModelSettings.n,
  };

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
 * Merges saved image settings with defaults derived from the active image model.
 */
export function mergeImageSettingsWithModel(settings: Partial<ImageModelSettings> = {}): ImageModelSettings {
  return mergeResolvedImageSettings(imageParamDefs, settings);
}

/**
 * Builds provider request params from user image settings.
 *
 * This is the image-side boundary where user settings become runtime request
 * body fields.
 */
export function buildImageGenerationParams(settings: Partial<ImageModelSettings> = {}): Record<string, unknown> {
  const mergedSettings = mergeResolvedImageSettings(imageParamDefs, settings);
  const params: Record<string, unknown> = {};

  imageParamDefs.forEach((item) => {
    const value = parseParamValue(item.type, mergedSettings[item.key], structuredClone(item.defaultValue));
    if (value === undefined || value === null) return;
    if (item.type === "string" && value === "") return;
    if (item.type === "array" && !Array.isArray(value)) return;
    if (item.type === "object" && (typeof value !== "object" || Array.isArray(value) || Object.keys(value || {}).length === 0)) return;
    if (item.type === "image" && (!value || typeof value !== "object" || !("filename" in value) || !("content_type" in value) || !("data" in value))) return;
    params[item.key] = value;
  });

  return params;
}
