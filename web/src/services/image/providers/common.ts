import { getModelRequestId } from "@/constants";
import { tr } from "@/i18n";
import type { ImageGenerationParams, ImageGenerationResult, ImageParamValue, ImageProviderModel, ImageRequest, RequestBody, TokenUsage } from "@/services/types";

export const DEFAULT_IMAGE_QUALITY = "auto";
export const DEFAULT_IMAGE_OUTPUT_FORMAT = "png";

export const IMAGE_OPERATION_ENDPOINT = {
  create: "generations",
  edit: "edits",
};

const RESERVED_IMAGE_PARAM_KEYS = ["prompt", "size", "n", "quality", "outputFormat"];

export function trimTrailingSlash(value: string = ""): string {
  return String(value || "").replace(/\/+$/, "");
}

export function isImageParamValue(value: unknown): value is { filename: string; content_type: string; data: string } {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { filename?: unknown; content_type?: unknown; data?: unknown };
  return Boolean(candidate.filename && candidate.content_type && candidate.data);
}

export function base64ToBlob(base64Data: string, contentType: string = "image/png"): Blob {
  const byteCharacters = atob(String(base64Data || ""));
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
    const slice = byteCharacters.slice(offset, offset + 1024);
    const byteNumbers = new Array(slice.length);

    for (let index = 0; index < slice.length; index += 1) {
      byteNumbers[index] = slice.charCodeAt(index);
    }

    byteArrays.push(new Uint8Array(byteNumbers));
  }

  return new Blob(byteArrays, { type: contentType });
}

export function hasImageInput(params: RequestBody = {}): boolean {
  return Object.values(params || {}).some((value) => isImageParamValue(value));
}

export function appendFormDataValue(formData: FormData, key: string, value: ImageParamValue): void {
  if (value === undefined || value === null || value === "") return;

  if (isImageParamValue(value)) {
    formData.append(key, base64ToBlob(value.data, value.content_type), value.filename);
    return;
  }

  if (typeof value === "object") {
    formData.append(key, JSON.stringify(value));
    return;
  }

  formData.append(key, String(value));
}

export function buildImageFormData(body: RequestBody = {}, options: { omitModel?: boolean } = {}): FormData {
  const formData = new FormData();

  Object.entries(body).forEach(([key, value]) => {
    if (options.omitModel && key === "model") return;
    appendFormDataValue(formData, key, value as ImageParamValue);
  });

  return formData;
}

export function buildImageRequestBody(model: ImageProviderModel, params: ImageGenerationParams, options: { omitModel?: boolean } = {}): { body: RequestBody; hasInputImage: boolean } {
  const prompt = params?.prompt || "";
  const size = params?.size || "1024x1024";
  const n = params?.n || 1;
  const quality = params?.quality || DEFAULT_IMAGE_QUALITY;
  const outputFormat = params?.outputFormat || DEFAULT_IMAGE_OUTPUT_FORMAT;
  const imageModel = getModelRequestId(model);
  const extraParams = Object.fromEntries(
    Object.entries(params || {}).filter(([key, value]) => {
      if (RESERVED_IMAGE_PARAM_KEYS.includes(key)) return false;
      if (value === undefined || value === null || value === "") return false;
      return true;
    }),
  );

  const body = {
    size,
    quality,
    output_format: outputFormat,
    n,
    prompt,
    ...(!options.omitModel && imageModel ? { model: imageModel } : {}),
    ...extraParams,
  };

  return {
    body,
    hasInputImage: hasImageInput(body),
  };
}

export function normalizeImageUsage(usage: Record<string, unknown> | null = null): TokenUsage {
  if (!usage || typeof usage !== "object") {
    return {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
    };
  }

  const inputTokens = Number(usage.input_tokens ?? usage.prompt_tokens ?? 0);
  const outputTokens = Number(usage.output_tokens ?? usage.completion_tokens ?? 0);
  const totalTokens = Number(usage.total_tokens ?? inputTokens + outputTokens);

  return {
    ...usage,
    input_tokens: Number.isFinite(inputTokens) ? inputTokens : 0,
    output_tokens: Number.isFinite(outputTokens) ? outputTokens : 0,
    total_tokens: Number.isFinite(totalTokens) ? totalTokens : 0,
  };
}

export function normalizeImageGenerationData(data: { data?: Array<{ url?: string; b64_json?: string; error?: { message?: string } }>; error?: { message?: string }; message?: string; usage?: Record<string, unknown> } | null): ImageGenerationResult {
  // Convert both URL and base64 OpenAI-compatible responses into the UI image shape.
  if (!Array.isArray(data?.data)) {
    const message = data?.error?.message || data?.message || JSON.stringify(data);
    return {
      images: [{ type: "text", data: message || tr("image.invalidResponse") }],
      usage: normalizeImageUsage(data?.usage),
      raw: data,
    };
  }

  const images = data.data.map((item): { type: "url" | "text"; data: string } => {
    if (item?.url) return { type: "url", data: item.url };
    if (item?.b64_json) return { type: "url", data: `data:image/png;base64,${item.b64_json}` };
    return { type: "text", data: item?.error?.message || tr("image.emptyResponseItem") };
  });

  return {
    images,
    usage: normalizeImageUsage(data?.usage),
    raw: data,
  };
}

export async function sendImageRequest(request: ImageRequest): Promise<ImageGenerationResult> {
  const body = request.isFormData ? (request.body as FormData) : JSON.stringify(request.body);
  const res = await fetch(request.url, {
    method: "POST",
    headers: request.headers,
    body,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message = data?.error?.message || data?.message || `${res.status} ${res.statusText}`;
    return { images: [{ type: "text", data: message }], usage: normalizeImageUsage(data?.usage), raw: data };
  }

  return normalizeImageGenerationData(data);
}
