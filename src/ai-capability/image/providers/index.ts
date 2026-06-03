import { normalizeImageUsage } from "./common";
import { generateDashScopeImage } from "./dashscope";
import { generateOpenAIImage } from "./openai";
import { ImageProviderConnectionField, ImageProviderDefinition, ImageProviderKey, imageProviderKeys, imageProviderRegistry } from "../types";
import type { ImageGenerationParams, ImageGenerationResult, ImageProviderModel } from "../types";

export function isImageModelProvider(value: unknown): value is ImageProviderKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(imageProviderRegistry, value);
}

export function getImageProviderDefinition(provider: unknown): ImageProviderDefinition | null {
  return isImageModelProvider(provider) ? imageProviderRegistry[provider] : null;
}

export function getImageProviderConnectionFields(provider: unknown): readonly ImageProviderConnectionField[] {
  return getImageProviderDefinition(provider)?.connectionFields || imageProviderRegistry.OpenAI.connectionFields;
}

export function imageProviderUsesField(provider: unknown, field: ImageProviderConnectionField): boolean {
  return getImageProviderConnectionFields(provider).includes(field);
}

export function getImageProviderDefaultBaseURL(provider: unknown): string {
  return getImageProviderDefinition(provider)?.defaultBaseURL || "";
}

export function getKnownImageProviderDefaultBaseURLs(): string[] {
  return imageProviderKeys.map((provider) => imageProviderRegistry[provider].defaultBaseURL || "").filter(Boolean);
}

export async function generateImageByProvider(model: ImageProviderModel, params: ImageGenerationParams): Promise<ImageGenerationResult> {
  try {
    if (model?.provider === "DashScope") {
      return await generateDashScopeImage(model, params);
    }
    return await generateOpenAIImage(model, params);
  } catch (err) {
    return { images: [{ type: "text", data: String(err) }], usage: normalizeImageUsage() };
  }
}
