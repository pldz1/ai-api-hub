import { generateImageByProvider } from "./providers";
import type { ImageGenerationParams, ImageGenerationResult, ImageInputFile, ImageProviderModel } from "./types";

export interface ImageAITurnRequest {
  mode: "generation" | "edit";
  prompt: string;
  model: ImageProviderModel;
  size?: string;
  n?: number;
  quality?: string;
  outputFormat?: string;
  attachments?: ImageInputFile[];
}

export type BuildImageGenerationParams = (settings: Record<string, unknown>) => Record<string, unknown>;

export function getImageAttachmentParams(mode: ImageAITurnRequest["mode"], attachments: ImageInputFile[] = []) {
  if (mode !== "edit" || attachments.length === 0) return {};
  const [image, mask] = attachments;

  return {
    image: image
      ? {
          filename: image.filename,
          content_type: image.content_type,
          data: image.data,
        }
      : undefined,
    mask: mask
      ? {
          filename: mask.filename,
          content_type: mask.content_type,
          data: mask.data,
        }
      : undefined,
  };
}

export function buildImageAIParams(request: ImageAITurnRequest, buildParams?: BuildImageGenerationParams): ImageGenerationParams {
  const settings = {
    prompt: request.prompt,
    size: request.size || "1024x1024",
    n: request.n || 1,
    quality: request.quality || "auto",
    output_format: request.outputFormat || "png",
    ...getImageAttachmentParams(request.mode, request.attachments || []),
  };
  const baseParams = buildParams ? buildParams(settings) : settings;

  return {
    ...baseParams,
    prompt: request.prompt,
    size: request.size || "1024x1024",
    n: request.n || 1,
    quality: request.quality || String(baseParams.quality || "auto"),
    outputFormat: request.outputFormat || String(baseParams.output_format || "png"),
  } as ImageGenerationParams;
}

export async function generateImage(model: ImageProviderModel, params: ImageGenerationParams): Promise<ImageGenerationResult> {
  return generateImageByProvider(model, params);
}

export async function runImageAITurn(request: ImageAITurnRequest, buildParams?: BuildImageGenerationParams): Promise<ImageGenerationResult> {
  return generateImageByProvider(request.model, buildImageAIParams(request, buildParams));
}
