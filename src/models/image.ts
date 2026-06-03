import type { ImageModelConfig, ImageModelSettings, ImageModelParamDef, LooseModelConfig } from "@/types";
import { imageParamPresetList } from "@/constants/image-model";
import { parseParamValue } from "./settings";
import {
  findImageModelCatalogItem,
  imageProviderKeys,
  isImageModelProvider,
  imageProviderUsesField,
  getImageProviderDefinition,
  getImageProviderDefaultBaseURL,
  getKnownImageProviderDefaultBaseURLs,
} from "@/ai-capability/image";

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

/**
 * Normalizes loose/legacy image model data into the canonical user config shape.
 *
 * Like `normalizeChatModelConfig`, this still returns user configuration rather
 * than low-level HTTP/runtime request args.
 */
export function normalizeImageModelConfig(model: LooseModelConfig | null | undefined = {}): ImageModelConfig {
  const data = model || {};
  const provider = String(data.provider || "") === "Qwen" ? "DashScope" : data.provider;
  const nextProvider = isImageModelProvider(provider) ? provider : "OpenAI";

  return {
    name: String(data.name || "").trim(),
    provider: nextProvider,
    baseURL: String(data.baseURL || "").trim(),
    apiKey: String(data.apiKey || "").trim(),
    model: String(data.model || "").trim(),
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

const normalizedImageParamDefs = new Map(imageParamPresetList.map((item) => [item.key, normalizeImageParamDef(item)] as const));

export function getImageProvidersForModel(model = "") {
  const catalogItem = findImageModelCatalogItem(model);
  if (!catalogItem) return imageProviderKeys;
  return catalogItem.providers.map((itemProvider) => itemProvider.provider);
}

export function resolveImageParamDefs(model: LooseModelConfig | null = null): ImageModelParamDef[] {
  const modelConfig = normalizeImageModelConfig(model || {});
  const catalogItem = findImageModelCatalogItem(modelConfig.model, modelConfig.provider);
  const paramKeys = catalogItem?.imageParamKeys || ["quality", "output_format", "image", "mask"];
  return paramKeys.map((key) => normalizedImageParamDefs.get(key)).filter(Boolean) as ImageModelParamDef[];
}

export const imageParamDefs: ImageModelParamDef[] = ["quality", "output_format", "image", "mask"].map((key) => normalizeImageParamDef({ key }));

export function getImageModelSizes(model: LooseModelConfig | null = null): string[] {
  const modelConfig = normalizeImageModelConfig(model || {});
  return (
    findImageModelCatalogItem(modelConfig.model, modelConfig.provider)?.sizeList || [
      "1024x1024",
      "1536x1024",
      "1024x1536",
      "2048x2048",
      "2048x1152",
      "3840x2160",
      "2160x3840",
      "auto",
    ]
  );
}

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
  return mergeResolvedImageSettings(resolveImageParamDefs(settings.model as LooseModelConfig | null), settings);
}

/**
 * Builds provider request params from user image settings.
 *
 * This is the image-side boundary where user settings become runtime request
 * body fields.
 */
export function buildImageGenerationParams(settings: Partial<ImageModelSettings> = {}): Record<string, unknown> {
  const defs = resolveImageParamDefs(settings.model as LooseModelConfig | null);
  const mergedSettings = mergeResolvedImageSettings(defs, settings);
  const params: Record<string, unknown> = {};

  defs.forEach((item) => {
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

export { getImageProviderDefinition, getImageProviderDefaultBaseURL, getKnownImageProviderDefaultBaseURLs, imageProviderUsesField, isImageModelProvider };
