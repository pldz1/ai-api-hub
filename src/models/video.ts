import type { VideoModelConfig, VideoModelSettings, VideoModelParamDef, LooseModelConfig } from "@/types";
import { videoParamPresetList } from "@/constants/video-model";
import { parseParamValue } from "./settings";
import {
  findVideoModelCatalogItem,
  videoProviderKeys,
  isVideoModelProvider,
  videoProviderUsesField,
  getVideoProviderDefinition,
  getVideoProviderDefaultBaseURL,
  getKnownVideoProviderDefaultBaseURLs,
} from "@/ai-capability/video";

const defaultVideoModelSettings = {
  model: null,
  prompt: "",
  resolution: "720P",
  duration: 5,
  promptExtend: true,
  watermark: true,
  first_frame: null,
} satisfies VideoModelSettings;

function getVideoParamPreset(key: string = ""): Partial<VideoModelParamDef> | null {
  return videoParamPresetList.find((item) => item.key === key) || null;
}

export function normalizeVideoModelConfig(model: LooseModelConfig | null | undefined = {}): VideoModelConfig {
  const data = model || {};
  const nextProvider = isVideoModelProvider(data.provider) ? data.provider : "DashScope";

  return {
    name: String(data.name || "").trim(),
    provider: nextProvider,
    baseURL: String(data.baseURL || "").trim(),
    apiKey: String(data.apiKey || "").trim(),
    model: String(data.model || "").trim(),
  };
}

export function normalizeVideoParamDef(def: Partial<VideoModelParamDef> = {}): VideoModelParamDef {
  const preset = getVideoParamPreset(def.key);
  const nextType = def.type || preset?.type || "string";
  const fallbackDefaultValue = Object.prototype.hasOwnProperty.call(preset || {}, "defaultValue")
    ? structuredClone(preset.defaultValue)
    : "";
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

const normalizedVideoParamDefs = new Map(
  videoParamPresetList.map((item) => [item.key, normalizeVideoParamDef(item)] as const),
);

export function getVideoProvidersForModel(model: string = "") {
  const catalogItem = findVideoModelCatalogItem(model);
  if (!catalogItem) return videoProviderKeys;
  return catalogItem.providers.map((p) => p.provider);
}

export function resolveVideoParamDefs(model: LooseModelConfig | null = null): VideoModelParamDef[] {
  const modelConfig = normalizeVideoModelConfig(model || {});
  const catalogItem = findVideoModelCatalogItem(modelConfig.model, modelConfig.provider);
  const paramKeys = catalogItem?.videoParamKeys || ["resolution", "duration", "prompt_extend", "watermark", "first_frame"];
  return paramKeys.map((key) => normalizedVideoParamDefs.get(key)).filter(Boolean) as VideoModelParamDef[];
}

export const videoParamDefs: VideoModelParamDef[] = ["resolution", "duration", "prompt_extend", "watermark", "first_frame"].map(
  (key) => normalizeVideoParamDef({ key }),
);

export function getVideoModelResolutions(model: LooseModelConfig | null = null): string[] {
  const modelConfig = normalizeVideoModelConfig(model || {});
  return findVideoModelCatalogItem(modelConfig.model, modelConfig.provider)?.resolutionList || ["720P", "1080P"];
}

function mergeResolvedVideoSettings(
  _defs: VideoModelParamDef[],
  settings: Partial<VideoModelSettings> = {},
): VideoModelSettings {
  return {
    ...structuredClone(defaultVideoModelSettings),
    model: settings.model ?? null,
    prompt: typeof settings.prompt === "string" ? settings.prompt : defaultVideoModelSettings.prompt,
    resolution: typeof settings.resolution === "string" && settings.resolution ? settings.resolution : defaultVideoModelSettings.resolution,
    duration: Number.isFinite(settings.duration) && Number(settings.duration) > 0 ? Number(settings.duration) : defaultVideoModelSettings.duration,
    promptExtend: typeof settings.promptExtend === "boolean" ? settings.promptExtend : defaultVideoModelSettings.promptExtend,
    watermark: typeof settings.watermark === "boolean" ? settings.watermark : defaultVideoModelSettings.watermark,
    first_frame: settings.first_frame ?? null,
  };
}

export function mergeVideoSettingsWithModel(settings: Partial<VideoModelSettings> = {}): VideoModelSettings {
  return mergeResolvedVideoSettings(resolveVideoParamDefs(settings.model as LooseModelConfig | null), settings);
}

export function buildVideoGenerationParams(settings: Partial<VideoModelSettings> = {}): Record<string, unknown> {
  const defs = resolveVideoParamDefs(settings.model as LooseModelConfig | null);
  const mergedSettings = mergeResolvedVideoSettings(defs, settings);
  const params: Record<string, unknown> = {};

  defs.forEach((item) => {
    const value = parseParamValue(item.type, mergedSettings[item.key], structuredClone(item.defaultValue));
    if (value === undefined || value === null) return;
    if (item.type === "string" && value === "") return;
    if (item.type === "array" && !Array.isArray(value)) return;
    if (item.type === "object" && (typeof value !== "object" || Array.isArray(value) || Object.keys(value || {}).length === 0))
      return;
    if (
      item.type === "image" &&
      (!value || typeof value !== "object" || !("filename" in value) || !("content_type" in value) || !("data" in value))
    )
      return;
    params[item.key] = value;
  });

  return params;
}

export {
  getVideoProviderDefinition,
  getVideoProviderDefaultBaseURL,
  getKnownVideoProviderDefaultBaseURLs,
  videoProviderUsesField,
  isVideoModelProvider,
};
