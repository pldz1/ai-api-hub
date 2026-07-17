import { imageProviderRegistry } from "./types";
import type {
  ImageAdapterId,
  ImageModelCapabilities,
  ImageModelConfig,
  ImageModelParamDef,
  ImageModelProvider,
  ImageProviderDefinition,
} from "./types";

export const imageParamList: Partial<ImageModelParamDef>[] = [
  { key: "quality", label: "quality", type: "string", descriptionKey: "image.qualityTip", defaultValue: "auto", placeholder: "auto" },
  {
    key: "output_format",
    label: "output_format",
    type: "string",
    descriptionKey: "image.outputFormatTip",
    defaultValue: "png",
    placeholder: "png",
  },
  { key: "background", label: "background", type: "string", descriptionKey: "image.backgroundTip", defaultValue: "", placeholder: "auto" },
  { key: "moderation", label: "moderation", type: "string", descriptionKey: "image.moderationTip", defaultValue: "", placeholder: "auto" },
  {
    key: "negative_prompt",
    label: "negative_prompt",
    type: "string",
    descriptionKey: "image.negativePromptTip",
    defaultValue: "",
    placeholder: "",
  },
  { key: "watermark", label: "watermark", type: "boolean", descriptionKey: "image.watermarkTip", defaultValue: false },
  { key: "image", label: "image", type: "image", descriptionKey: "image.inputImageTip", defaultValue: null, placeholder: "image/png" },
  { key: "mask", label: "mask", type: "image", descriptionKey: "image.maskTip", defaultValue: null, placeholder: "image/png" },
];

/** One explicit model/provider combination consumed by both UI and runtime. */
export interface ImageModelBinding {
  key: string;
  model: string;
  provider: ImageModelProvider;
  adapterId: ImageAdapterId;
  adapterOptions?: Record<string, unknown>;
  paramKeys: string[];
  sizeList: string[];
  capabilities: ImageModelCapabilities;
}

export interface ResolvedImageModel {
  config: ImageModelConfig;
  provider: ImageProviderDefinition;
  binding: ImageModelBinding;
  knownModel: boolean;
}

function defineBinding(
  model: string,
  provider: ImageModelProvider,
  spec: Pick<ImageModelBinding, "paramKeys" | "sizeList" | "capabilities">,
): ImageModelBinding {
  return {
    key: `${provider}:${model}`,
    model,
    provider,
    adapterId: imageProviderRegistry[provider].adapterId,
    paramKeys: [...spec.paramKeys],
    sizeList: [...spec.sizeList],
    capabilities: { ...spec.capabilities },
  };
}

const commonSizes = ["1024x1024", "1536x1024", "1024x1536", "2048x2048", "2048x1152", "3840x2160", "2160x3840"];

export const imageModelBindings: ImageModelBinding[] = [
  ...(["OpenAI", "Azure OpenAI"] as const).map((provider) =>
    defineBinding("gpt-image-2", provider, {
      paramKeys: ["quality", "output_format", "background", "moderation", "image", "mask"],
      sizeList: [...commonSizes, "auto"],
      capabilities: { imageInput: true, maskInput: true },
    }),
  ),
  defineBinding("qwen-image-2.0-pro-2026-04-22", "DashScope", {
    paramKeys: ["negative_prompt", "watermark", "image"],
    sizeList: commonSizes,
    capabilities: { imageInput: true, maskInput: false },
  }),
];

export const imageCatalogModelIds = [...new Set(imageModelBindings.map((binding) => binding.model))];

export function findImageModelBindings(model = ""): ImageModelBinding[] {
  const targetModel = model.trim().toLowerCase();
  if (!targetModel) return [];
  return imageModelBindings.filter((binding) => binding.model.toLowerCase() === targetModel);
}

/** Exact lookup. A requested provider never falls back to another provider. */
export function findImageModelBinding(model = "", provider?: ImageModelProvider | null): ImageModelBinding | null {
  const bindings = findImageModelBindings(model);
  if (!bindings.length) return null;
  if (!provider) return bindings[0] || null;
  return bindings.find((binding) => binding.provider === provider) || null;
}

export function resolveImageModel(config: ImageModelConfig): ResolvedImageModel | null {
  const provider = imageProviderRegistry[config.provider];
  if (!provider) return null;

  const knownBinding = findImageModelBinding(config.model, config.provider);
  const binding: ImageModelBinding =
    knownBinding ||
    {
      key: `${config.provider}:${config.model || "custom"}`,
      model: config.model,
      provider: config.provider,
      adapterId: provider.adapterId,
      paramKeys: ["quality", "output_format"],
      sizeList: [...commonSizes, "auto"],
      capabilities: { ...defaultImageModelCapabilities },
    };

  return {
    config: { ...config, baseURL: config.baseURL || provider.defaultBaseURL || "" },
    provider,
    binding,
    knownModel: Boolean(knownBinding),
  };
}

export const defaultImageModelCapabilities: ImageModelCapabilities = {
  imageInput: false,
  maskInput: false,
};

export const imageDisplayedCapabilityKeys: (keyof ImageModelCapabilities)[] = ["imageInput", "maskInput"];
