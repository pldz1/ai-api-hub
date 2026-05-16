import type { ImageOperation, ModelConfigBase } from "./shared";

/**
 * User-owned image model configuration persisted in settings/import/export.
 */
export interface ImageProviderPayloadBase extends ModelConfigBase {
  imageOperation: ImageOperation;
}

/** Image model payload for direct OpenAI-compatible routing. */
export interface OpenAIImageProviderPayload extends ImageProviderPayloadBase {
  provider: "OpenAI";
  baseURL: string;
}

/** Image model payload for Azure OpenAI routing via endpoint + deployment. */
export interface AzureOpenAIImageProviderPayload extends ImageProviderPayloadBase {
  provider: "Azure OpenAI";
  endpoint: string;
  deployment: string;
  apiVersion: string;
}

/** All persisted image model payloads owned by the user. */
export type ImageProviderPayload = OpenAIImageProviderPayload | AzureOpenAIImageProviderPayload;
