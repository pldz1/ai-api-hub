import { BaseVideoClient } from "../../common/video-client";
import { normalizeVideoUsage } from "../../common/usage";
import type { JsonObject } from "../../common";
import type { VideoGenerationParams, VideoGenerationResult, VideoInputFile, VideoParamValue } from "../types";

// -- constants -------------------------------------------------------------

const DASHSCOPE_ORIGIN = "https://dashscope.aliyuncs.com";
const DASHSCOPE_PROXY_PREFIX = "/io/llm/ai-api-hub-dashscope-proxy";

const DEFAULT_DASHSCOPE_VIDEO_URL = `${DASHSCOPE_ORIGIN}/api/v1/services/aigc/video-generation/video-synthesis`;
const DASHSCOPE_TASK_BASE_URL = `${DASHSCOPE_ORIGIN}/api/v1/tasks`;

const DASHSCOPE_RESERVED_PARAM_KEYS = ["prompt", "resolution", "duration", "promptExtend", "prompt_extend", "watermark", "media", "first_frame", "last_frame"];

// -- helpers ---------------------------------------------------------------

function imageFileToDataUrl(file: VideoInputFile): string {
  if (!file?.data) return "";
  const data = String(file.data);
  // Already a full data URL (from pre-processing / resize step).
  if (data.startsWith("data:")) return data;
  // Raw base64 — wrap it.
  return `data:${file.content_type || "image/png"};base64,${data}`;
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function buildMediaArray(params: VideoGenerationParams): Array<{ type: string; url: string }> {
  const media: Array<{ type: string; url: string }> = [];

  const pushFrame = (frame: VideoInputFile | null | undefined, mediaType: string) => {
    if (!frame?.data || !frame?.content_type) return;
    const data = String(frame.data);
    // HTTP/HTTPS URL — pass directly.
    if (isHttpUrl(data)) {
      media.push({ type: mediaType, url: data });
      return;
    }
    // Local file — pass as base64 data URL.
    media.push({ type: mediaType, url: imageFileToDataUrl(frame) });
  };

  pushFrame(params["first_frame"] as unknown as VideoInputFile | undefined, "first_frame");
  pushFrame(params["last_frame"] as unknown as VideoInputFile | undefined, "last_frame");

  if (Array.isArray(params.media)) {
    for (const m of params.media) {
      if (!m?.data || !m?.content_type) continue;
      const isAudio = m.content_type.startsWith("audio/") || m.filename?.includes("audio");
      if (isAudio) {
        media.push({ type: "driving_audio", url: imageFileToDataUrl(m) });
      } else {
        pushFrame(m, "first_frame");
      }
    }
  }

  return media;
}

function buildDashScopeParameters(params: VideoGenerationParams): Record<string, VideoParamValue> {
  const parameters: Record<string, VideoParamValue> = {};

  if (params.resolution) parameters.resolution = params.resolution;
  if (params.duration !== undefined) parameters.duration = params.duration;
  if (params.promptExtend !== undefined) parameters.prompt_extend = params.promptExtend;
  if (params.watermark !== undefined) parameters.watermark = params.watermark;

  Object.entries(params).forEach(([key, value]) => {
    if (DASHSCOPE_RESERVED_PARAM_KEYS.includes(key)) return;
    if (value === undefined || value === null || value === "") return;
    parameters[key] = value as VideoParamValue;
  });

  return parameters;
}

function normalizeDashScopeVideoResult(data: JsonObject): VideoGenerationResult {
  const output = (data?.output || {}) as Record<string, unknown>;
  const taskStatus = String(output.task_status || "").toUpperCase();
  const videoUrl = String(output.video_url || "");

  if (taskStatus === "FAILED" || !videoUrl) {
    return {
      videos: [
        {
          type: "text",
          data: String(output.message || output.code || `Task ended with status: ${taskStatus || "UNKNOWN"}`),
        },
      ],
      usage: normalizeVideoUsage(data?.usage as Record<string, unknown> | null),
      taskStatus: taskStatus as VideoGenerationResult["taskStatus"],
      raw: data,
    };
  }

  return {
    videos: [{ type: "url", data: videoUrl }],
    usage: normalizeVideoUsage(data?.usage as Record<string, unknown> | null),
    taskStatus: "SUCCEEDED",
    raw: data,
  };
}

// -- client ----------------------------------------------------------------

export class DashScopeVideoClient extends BaseVideoClient {
  private applyProxy(url: string): string {
    if (!this.useProxy) return url;
    return url.replace(DASHSCOPE_ORIGIN, DASHSCOPE_PROXY_PREFIX);
  }

  getUrl(_params: VideoGenerationParams): string {
    return this.applyProxy(this.trimTrailingSlash(this.baseURL || DEFAULT_DASHSCOPE_VIDEO_URL));
  }

  getBody(params: VideoGenerationParams): { body: Record<string, unknown>; isFormData: boolean } {
    const prompt = (params.prompt || "").trim() || "Generate a video.";
    const media = buildMediaArray(params);

    const input: Record<string, unknown> = { prompt };
    if (media.length) input.media = media;

    return {
      body: { model: this.model, input, parameters: buildDashScopeParameters(params) },
      isFormData: false,
    };
  }

  getFetchUrl(data: JsonObject): string {
    const taskId = (data?.output as Record<string, unknown> | undefined)?.task_id;
    if (!taskId) throw new Error("No task_id in DashScope video submission response");
    return this.applyProxy(`${DASHSCOPE_TASK_BASE_URL}/${taskId}`);
  }

  responseFromTaskResult(data: JsonObject): VideoGenerationResult {
    return normalizeDashScopeVideoResult(data);
  }
}
