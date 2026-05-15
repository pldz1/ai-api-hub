import { normalizeImageUsage } from "./common";
import { generateAzureOpenAIImage } from "./azure-openai";
import { generateOpenAIImage } from "./openai";
import type { ImageGenerationParams, ImageGenerationResult, ImageProviderModel } from "@/services/types";

export { normalizeImageUsage } from "./common";
export { buildAzureOpenAIImageRequest, generateAzureOpenAIImage } from "./azure-openai";
export { buildOpenAIImageRequest, generateOpenAIImage } from "./openai";

export async function generateImageByProvider(model: ImageProviderModel, params: ImageGenerationParams): Promise<ImageGenerationResult> {
  try {
    if (model?.provider === "Azure OpenAI") {
      return await generateAzureOpenAIImage(model, params);
    }

    return await generateOpenAIImage(model, params);
  } catch (err) {
    return { images: [{ type: "text", data: String(err) }], usage: normalizeImageUsage() };
  }
}
