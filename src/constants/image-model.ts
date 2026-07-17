import { imageParamList } from "@/ai-capability";
import type { ImageModelEditorState, ImageModelParamDef } from "@/types";

export const imageParamPresetList: Partial<ImageModelParamDef>[] = imageParamList;

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
  imageModelBindings,
  imageCatalogModelIds,
  defaultImageModelCapabilities,
  imageDisplayedCapabilityKeys,
} from "@/ai-capability/image";
