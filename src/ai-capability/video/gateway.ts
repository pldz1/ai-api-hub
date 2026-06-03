import { createVideoExecutor, createVideoProviderConfig } from "./providers/executor";
import { normalizeVideoUsage } from "../common/usage";
import type { VideoGenerationParams, VideoGenerationResult, VideoInputFile, VideoProviderModel } from "./types";

// -- request shape ---------------------------------------------------------

export interface VideoAITurnRequest {
  prompt: string;
  model: VideoProviderModel;
  resolution?: string;
  duration?: number;
  promptExtend?: boolean;
  watermark?: boolean;
  media?: VideoInputFile[];
  first_frame?: VideoInputFile;
  last_frame?: VideoInputFile;
}

// -- param builder ---------------------------------------------------------

export type BuildVideoGenerationParams = (settings: Record<string, unknown>) => Record<string, unknown>;

export function buildVideoAIParams(
  request: VideoAITurnRequest,
  buildParams?: BuildVideoGenerationParams,
): VideoGenerationParams {
  const settings: Record<string, unknown> = {
    model: request.model,
    prompt: request.prompt,
    resolution: request.resolution || "720P",
    duration: request.duration || 5,
    promptExtend: request.promptExtend ?? true,
    watermark: request.watermark ?? true,
    media: request.media || [],
    first_frame: request.first_frame || undefined,
    last_frame: request.last_frame || undefined,
  };

  const baseParams = buildParams ? buildParams(settings) : settings;

  return {
    ...baseParams,
    prompt: request.prompt,
    resolution: String(baseParams.resolution ?? request.resolution ?? "720P"),
    duration: Number(baseParams.duration ?? request.duration ?? 5),
    promptExtend: Boolean(baseParams.promptExtend ?? request.promptExtend ?? true),
    watermark: Boolean(baseParams.watermark ?? request.watermark ?? true),
    media: (Array.isArray(baseParams.media) ? baseParams.media : request.media || []) as VideoInputFile[],
    first_frame: (baseParams.first_frame || request.first_frame || undefined) as VideoInputFile | undefined,
    last_frame: (baseParams.last_frame || request.last_frame || undefined) as VideoInputFile | undefined,
  } as VideoGenerationParams;
}

// -- public API ------------------------------------------------------------

export async function generateVideo(
  model: VideoProviderModel,
  params: VideoGenerationParams,
): Promise<VideoGenerationResult> {
  const config = createVideoProviderConfig(model);
  if (!config) {
    return {
      videos: [{ type: "text", data: `Unknown video provider: ${model?.provider || "unknown"}` }],
      usage: normalizeVideoUsage(),
    };
  }

  try {
    const executor = createVideoExecutor(config);
    return await executor.generate(params);
  } catch (err) {
    return { videos: [{ type: "text", data: String(err) }], usage: normalizeVideoUsage() };
  }
}

export async function runVideoAITurn(
  request: VideoAITurnRequest,
  buildParams?: BuildVideoGenerationParams,
): Promise<VideoGenerationResult> {
  return generateVideo(request.model, buildVideoAIParams(request, buildParams));
}
