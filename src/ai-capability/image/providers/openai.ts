import { buildImageFormData, buildImageRequestBody, IMAGE_OPERATION_ENDPOINT, sendImageRequest, trimTrailingSlash } from "./common";
import type { ImageGenerationParams, ImageGenerationResult, ImageProviderModel, ImageRequest } from "../types";

function resolveImageEndpointUrl(url: string = "", hasInputImage: boolean = false): string {
  const trimmedUrl = String(url || "").trim();
  if (!hasInputImage) return trimmedUrl;

  return trimmedUrl.replace(/\/images\/generations(?=($|[?#]))/, `/images/${IMAGE_OPERATION_ENDPOINT.edit}`);
}

function buildOpenAIImageEndpointUrl(baseURL: string = "", hasInputImage: boolean = false): string {
  // Accept either a bare API base URL or a full `/images/generations` URL.
  const trimmedUrl = trimTrailingSlash(baseURL || "https://api.openai.com/v1");
  const endpoint = hasInputImage ? IMAGE_OPERATION_ENDPOINT.edit : IMAGE_OPERATION_ENDPOINT.create;

  if (/\/images\/(generations|edits)(?=($|[?#]))/.test(trimmedUrl)) {
    return resolveImageEndpointUrl(trimmedUrl, hasInputImage);
  }

  return `${trimmedUrl}/images/${endpoint}`;
}

function getImageBaseURL(model: ImageProviderModel): string {
  return String((model as { baseURL?: string } | null | undefined)?.baseURL || "");
}

export function buildOpenAIImageRequest(model: ImageProviderModel, params: ImageGenerationParams): ImageRequest {
  const { body, hasInputImage } = buildImageRequestBody(model, params);
  const url = buildOpenAIImageEndpointUrl(getImageBaseURL(model), hasInputImage);

  if (!url || !model?.apiKey) {
    throw new Error("OpenAI image provider is not configured.");
  }

  return {
    url,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${model.apiKey}`,
      ...(!hasInputImage ? { "content-type": "application/json" } : {}),
    },
    body: hasInputImage ? buildImageFormData(body) : body,
    isFormData: hasInputImage,
  };
}

export async function generateOpenAIImage(model: ImageProviderModel, params: ImageGenerationParams): Promise<ImageGenerationResult> {
  return sendImageRequest(buildOpenAIImageRequest(model, params));
}
