import { buildImageFormData, buildImageRequestBody, IMAGE_OPERATION_ENDPOINT, sendImageRequest, trimTrailingSlash } from "./common";
import { tr } from "@/i18n";
import type { ImageGenerationParams, ImageGenerationResult, ImageProviderModel, ImageRequest } from "@/services/types";

function appendApiVersion(url: string, apiVersion: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}api-version=${encodeURIComponent(apiVersion)}`;
}

function buildAzureOpenAIImageEndpointUrl(model: ImageProviderModel, hasInputImage: boolean = false): string {
  const endpoint = trimTrailingSlash(model?.endpoint || "");
  const deployment = String(model?.deployment || "").trim();
  const apiVersion = String(model?.apiVersion || "").trim();
  const operation = hasInputImage ? IMAGE_OPERATION_ENDPOINT.edit : IMAGE_OPERATION_ENDPOINT.create;

  if (!endpoint || !deployment || !apiVersion) return "";

  const path = `${endpoint}/openai/deployments/${encodeURIComponent(deployment)}/images/${operation}`;
  return appendApiVersion(path, apiVersion);
}

export function buildAzureOpenAIImageRequest(model: ImageProviderModel, params: ImageGenerationParams): ImageRequest {
  // Azure selects the model by deployment in the URL, so `model` is omitted.
  const { body, hasInputImage } = buildImageRequestBody(model, params, { omitModel: true });
  const url = buildAzureOpenAIImageEndpointUrl(model, hasInputImage);

  if (!url || !model?.apiKey) {
    throw new Error(tr("image.providerConfigIncomplete", { provider: "Azure OpenAI" }));
  }

  return {
    url,
    headers: {
      accept: "application/json",
      "api-key": model.apiKey,
      ...(!hasInputImage ? { "content-type": "application/json" } : {}),
    },
    body: hasInputImage ? buildImageFormData(body, { omitModel: true }) : body,
    isFormData: hasInputImage,
  };
}

export async function generateAzureOpenAIImage(model: ImageProviderModel, params: ImageGenerationParams): Promise<ImageGenerationResult> {
  return sendImageRequest(buildAzureOpenAIImageRequest(model, params));
}
