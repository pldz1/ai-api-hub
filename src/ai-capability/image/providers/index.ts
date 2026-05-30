import { normalizeImageUsage } from "./common";
import { generateOpenAIImage } from "./openai";
import type { ImageGenerationParams, ImageGenerationResult, ImageProviderModel } from "../types";

export async function generateImageByProvider(model: ImageProviderModel, params: ImageGenerationParams): Promise<ImageGenerationResult> {
  try {
    return await generateOpenAIImage(model, params);
  } catch (err) {
    return { images: [{ type: "text", data: String(err) }], usage: normalizeImageUsage() };
  }
}
