import { createImageExecutor, createImageProviderConfig } from "./providers/executor";
import { normalizeImageUsage } from "../common/usage";
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
    model: request.model,
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
    attachments: request.attachments || [],
  } as ImageGenerationParams;
}

export async function generateImage(model: ImageProviderModel, params: ImageGenerationParams): Promise<ImageGenerationResult> {
  const config = createImageProviderConfig(model);
  if (!config) {
    return {
      images: [{ type: "text", data: `Unknown image provider: ${model?.provider || "unknown"}` }],
      usage: normalizeImageUsage(),
    };
  }

  try {
    const executor = createImageExecutor(config);
    return await executor.generate(params);
  } catch (err) {
    return { images: [{ type: "text", data: String(err) }], usage: normalizeImageUsage() };
  }
}

export async function runImageAITurn(request: ImageAITurnRequest, buildParams?: BuildImageGenerationParams): Promise<ImageGenerationResult> {
  return generateImage(request.model, buildImageAIParams(request, buildParams));
}
