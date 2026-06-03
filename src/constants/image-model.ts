import { imageParamList } from "@/ai-capability";
import type { ImageModelEditorState, ImageModelParamDef } from "@/types";

function transformToPresetList(originalList: Partial<ImageModelParamDef>[]) {
  const descriptionMapping: Record<string, Partial<ImageModelParamDef>> = {
    quality: { descriptionKey: "image.qualityTip" },
    output_format: { descriptionKey: "image.outputFormatTip" },
    background: { descriptionKey: "image.backgroundTip" },
    moderation: { descriptionKey: "image.moderationTip" },
    negative_prompt: { descriptionKey: "image.negativePromptTip" },
    watermark: { descriptionKey: "image.watermarkTip" },
    image: { descriptionKey: "image.inputImageTip" },
    mask: { descriptionKey: "image.maskTip" },
  };

  return originalList.map((item) => ({
    ...item,
    ...(descriptionMapping[item.key || ""] || {}),
  }));
}

export const imageParamPresetList: Partial<ImageModelParamDef>[] = transformToPresetList(imageParamList);

export const imageModelSize = ["1024x1024", "1536x1024", "1024x1536", "2048x2048", "2048x1152", "3840x2160", "2160x3840", "auto"];

export const defaultImageModelEditorState: ImageModelEditorState = {
  name: "",
  provider: "",
  baseURL: "",
  apiKey: "",
  model: "",
};

export {
  imageProviderKeys as imageModelProviderList,
  imageProviderKeys,
  imageModelCatalog,
  imageModelTypeList,
  defaultImageModelCapabilities,
  imageDisplayedCapabilityKeys,
} from "@/ai-capability/image";
