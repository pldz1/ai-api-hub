import type { ImageModelConfig, ImageModelSettings, ImageOperation, ModelParamDef } from "@/types/model";
import { defImageModelSeting, imageParamPresetList } from "@/constants/image-model";
import {
  cloneJson,
  getModelRequestId,
  hasMeaningfulParamValue,
  normalizeModelFormDraft,
  parseParamValue,
  type LooseModelConfig,
  type LooseParamDef,
} from "./common";

function getImageParamPreset(key = ""): LooseParamDef | null {
  return imageParamPresetList.find((item) => item.key === key) || null;
}

export function isAzureImageModel(model: LooseModelConfig | null | undefined): model is LooseModelConfig & { provider: "Azure OpenAI" } {
  return normalizeModelFormDraft(model).provider === "Azure OpenAI";
}

/** Coerces persisted image config into the runtime image model shape. */
export function toRuntimeImageModelConfig(model: LooseModelConfig | null | undefined = {}, imageOperation: ImageOperation = "generation"): ImageModelConfig {
  const draft = normalizeModelFormDraft(model);
  const provider = draft.provider === "Azure OpenAI" ? draft.provider : "OpenAI";
  const modelId = getModelRequestId(draft);

  if (provider === "Azure OpenAI") {
    return {
      name: draft.name,
      provider,
      endpoint: draft.endpoint,
      deployment: draft.deployment,
      apiVersion: draft.apiVersion,
      apiKey: draft.apiKey,
      model: modelId,
      imageOperation,
    };
  }

  return {
    name: draft.name,
    provider,
    baseURL: draft.baseURL,
    apiKey: draft.apiKey,
    model: modelId,
    imageOperation,
  };
}

/** Merges an image parameter definition with its built-in preset defaults. */
export function normalizeImageParamDef(def: LooseParamDef = {}): ModelParamDef {
  const preset = getImageParamPreset(def.key);
  const nextType = def.type || preset?.type || "string";
  const fallbackDefaultValue = Object.prototype.hasOwnProperty.call(preset || {}, "defaultValue") ? cloneJson(preset.defaultValue) : "";
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

/** Returns default image generation parameter definitions. */
export function getDefaultImageParamDefs(): ModelParamDef[] {
  return ["quality", "output_format"].map((key) => normalizeImageParamDef({ key }));
}

/** Returns default image edit parameter definitions. */
export function getDefaultImageEditParamDefs(): ModelParamDef[] {
  return ["quality", "output_format", "image", "mask"].map((key) => normalizeImageParamDef({ key }));
}

/** Returns normalized image parameter definitions for a configured image model. */
export function getModelImageParamDefs(model: LooseModelConfig = {}): ModelParamDef[] {
  const defaultDefs = model?.imageOperation === "edit" ? getDefaultImageEditParamDefs() : getDefaultImageParamDefs();
  const supportedKeys = new Set(imageParamPresetList.map((item) => item.key).filter(Boolean));
  const configuredDefs =
    Array.isArray(model?.imageParamDefs) && model.imageParamDefs.length > 0
      ? model.imageParamDefs.filter((item) => item.key && supportedKeys.has(item.key))
      : defaultDefs;
  const defs =
    model?.imageOperation === "edit"
      ? [...configuredDefs, ...getDefaultImageEditParamDefs().filter((defaultDef) => !configuredDefs.some((item) => item.key === defaultDef.key))]
      : configuredDefs;
  const seen = new Set();

  return defs.map((item) => normalizeImageParamDef(item)).filter((item) => item.key && !seen.has(item.key) && (seen.add(item.key), true));
}

/** Builds default image settings from a model's parameter definitions. */
export function buildDefaultImageSettings(model: LooseModelConfig | null = null): ImageModelSettings {
  const settings = cloneJson(defImageModelSeting);
  const defs = getModelImageParamDefs(model || {});

  defs.forEach((item) => {
    settings[item.key] = cloneJson(item.defaultValue);
  });

  return settings;
}

/** Merges user image settings with model defaults and parses parameter values. */
export function mergeImageSettingsWithModel(model: LooseModelConfig | null = null, settings: Partial<ImageModelSettings> = {}): ImageModelSettings {
  const coreSettings: Partial<ImageModelSettings> = {
    model: settings.model ?? null,
    prompt: typeof settings.prompt === "string" ? settings.prompt : defImageModelSeting.prompt,
    size: typeof settings.size === "string" && settings.size ? settings.size : defImageModelSeting.size,
    image: settings.image ?? null,
    mask: settings.mask ?? null,
    n: settings.n ?? defImageModelSeting.n,
  };
  const mergedSettings = {
    ...buildDefaultImageSettings(model),
    ...coreSettings,
  };

  const defs = getModelImageParamDefs(model || {});
  defs.forEach((item) => {
    mergedSettings[item.key] = parseParamValue(item.type, mergedSettings[item.key], cloneJson(item.defaultValue));
  });

  if (!Number.isFinite(Number(mergedSettings.n)) || Number(mergedSettings.n) < 1) {
    mergedSettings.n = defImageModelSeting.n;
  } else {
    mergedSettings.n = Number(mergedSettings.n);
  }

  return mergedSettings;
}

/** Builds provider request parameters for image generation or edit calls. */
export function buildImageGenerationParams(model: LooseModelConfig | null = null, settings: Partial<ImageModelSettings> = {}): Record<string, unknown> {
  const defs = getModelImageParamDefs(model || {});
  const mergedSettings = mergeImageSettingsWithModel(model, settings);
  const params: Record<string, unknown> = {};

  defs.forEach((item) => {
    const value = parseParamValue(item.type, mergedSettings[item.key], cloneJson(item.defaultValue));
    if (!hasMeaningfulParamValue(item.type, value)) return;
    params[item.key] = value;
  });

  return params;
}
