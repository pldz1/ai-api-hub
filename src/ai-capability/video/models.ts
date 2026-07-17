import { videoProviderRegistry } from "./types";
import type {
  VideoAdapterId,
  VideoModelCapabilities,
  VideoModelConfig,
  VideoModelParamDef,
  VideoModelProvider,
  VideoProviderDefinition,
} from "./types";

export const videoParamList: Partial<VideoModelParamDef>[] = [
  {
    key: "resolution",
    label: "resolution",
    type: "string",
    descriptionKey: "video.resolutionTip",
    defaultValue: "720P",
    placeholder: "720P",
  },
  {
    key: "duration",
    label: "duration",
    type: "number",
    descriptionKey: "video.durationTip",
    defaultValue: 5,
    min: 5,
    max: 10,
    step: 5,
    placeholder: "5",
  },
  {
    key: "prompt_extend",
    label: "prompt_extend",
    type: "boolean",
    descriptionKey: "video.promptExtendTip",
    defaultValue: true,
    placeholder: "",
  },
  {
    key: "watermark",
    label: "watermark",
    type: "boolean",
    descriptionKey: "video.watermarkTip",
    defaultValue: true,
    placeholder: "",
  },
  {
    key: "first_frame",
    label: "first_frame",
    type: "image",
    descriptionKey: "video.firstFrameTip",
    defaultValue: null,
    placeholder: "image/png",
  },
];

/** One explicit model/provider combination consumed by both UI and runtime. */
export interface VideoModelBinding {
  key: string;
  model: string;
  provider: VideoModelProvider;
  adapterId: VideoAdapterId;
  adapterOptions?: Record<string, unknown>;
  paramKeys: string[];
  resolutionList: string[];
  capabilities: VideoModelCapabilities;
}

export interface ResolvedVideoModel {
  config: VideoModelConfig;
  provider: VideoProviderDefinition;
  binding: VideoModelBinding;
  knownModel: boolean;
}

function defineBinding(
  model: string,
  capabilities: VideoModelCapabilities,
): VideoModelBinding {
  const provider = "DashScope";
  return {
    key: `${provider}:${model}`,
    model,
    provider,
    adapterId: videoProviderRegistry[provider].adapterId,
    paramKeys: ["resolution", "duration", "prompt_extend", "watermark", "first_frame"],
    resolutionList: ["720P", "1080P"],
    capabilities: { ...capabilities },
  };
}

export const videoModelBindings: VideoModelBinding[] = [
  defineBinding("wan2.7-i2v-2026-04-25", { imageInput: true, audioInput: true, videoInput: false }),
  defineBinding("wan2.7-t2v", { imageInput: false, audioInput: false, videoInput: false }),
  defineBinding("wan2.7-r2v", { imageInput: true, audioInput: true, videoInput: true }),
  defineBinding("wan2.7-videoedit", { imageInput: true, audioInput: true, videoInput: true }),
];

export const videoCatalogModelIds = [...new Set(videoModelBindings.map((binding) => binding.model))];

export function findVideoModelBindings(model = ""): VideoModelBinding[] {
  const targetModel = model.trim().toLowerCase();
  if (!targetModel) return [];
  return videoModelBindings.filter((binding) => binding.model.toLowerCase() === targetModel);
}

/** Exact lookup. A requested provider never falls back to another provider. */
export function findVideoModelBinding(model = "", provider?: VideoModelProvider | null): VideoModelBinding | null {
  const bindings = findVideoModelBindings(model);
  if (!bindings.length) return null;
  if (!provider) return bindings[0] || null;
  return bindings.find((binding) => binding.provider === provider) || null;
}

export function resolveVideoModel(config: VideoModelConfig): ResolvedVideoModel | null {
  const provider = videoProviderRegistry[config.provider];
  if (!provider) return null;

  const knownBinding = findVideoModelBinding(config.model, config.provider);
  const binding: VideoModelBinding =
    knownBinding ||
    {
      key: `${config.provider}:${config.model || "custom"}`,
      model: config.model,
      provider: config.provider,
      adapterId: provider.adapterId,
      paramKeys: ["resolution", "duration", "prompt_extend", "watermark"],
      resolutionList: ["720P", "1080P"],
      capabilities: { ...defaultVideoModelCapabilities },
    };

  return {
    config: { ...config, baseURL: config.baseURL || provider.defaultBaseURL || "" },
    provider,
    binding,
    knownModel: Boolean(knownBinding),
  };
}

export const defaultVideoModelCapabilities: VideoModelCapabilities = {
  imageInput: false,
  audioInput: false,
  videoInput: false,
};

export const videoDisplayedCapabilityKeys: (keyof VideoModelCapabilities)[] = ["imageInput", "audioInput"];
