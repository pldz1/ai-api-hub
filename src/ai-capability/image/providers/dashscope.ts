import { normalizeImageUsage, trimTrailingSlash } from "./common";
import type { ImageGenerationParams, ImageGenerationResult, ImageInputFile, ImageParamValue, ImageProviderModel, ImageRequest } from "../types";

const DEFAULT_DASHSCOPE_IMAGE_URL =
  "https://<workspace-id>.ap-southeast-1.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation";

const DASHSCOPE_RESERVED_PARAM_KEYS = ["prompt", "size", "n", "quality", "outputFormat", "output_format", "attachments", "image", "mask"];

function getDashScopeImageEndpointUrl(baseURL: string = ""): string {
  return trimTrailingSlash(baseURL || DEFAULT_DASHSCOPE_IMAGE_URL);
}

function normalizeDashScopeSize(size = ""): string {
  return String(size || "").trim().replace("x", "*");
}

function imageFileToDataUrl(file: ImageInputFile): string {
  if (!file?.data) return "";
  const data = String(file.data);
  if (data.startsWith("data:")) return data;
  return `data:${file.content_type || "image/png"};base64,${data}`;
}

function collectDashScopeInputImages(params: ImageGenerationParams): ImageInputFile[] {
  const images: ImageInputFile[] = [];
  const addImage = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    const candidate = value as Partial<ImageInputFile>;
    if (candidate.data && candidate.content_type && candidate.filename) {
      images.push(candidate as ImageInputFile);
    }
  };

  if (Array.isArray(params.attachments)) {
    params.attachments.forEach(addImage);
  }
  addImage(params.image);

  return images;
}

function buildDashScopeParameters(params: ImageGenerationParams): Record<string, ImageParamValue> {
  const parameters: Record<string, ImageParamValue> = {};

  if (params.n !== undefined && params.n !== null) parameters.n = params.n;
  const size = normalizeDashScopeSize(params.size || "");
  if (size && size !== "auto") parameters.size = size;

  Object.entries(params || {}).forEach(([key, value]) => {
    if (DASHSCOPE_RESERVED_PARAM_KEYS.includes(key)) return;
    if (value === undefined || value === null || value === "") return;
    parameters[key] = value as ImageParamValue;
  });

  return parameters;
}

export function buildDashScopeImageRequest(model: ImageProviderModel, params: ImageGenerationParams): ImageRequest {
  const url = getDashScopeImageEndpointUrl(model?.baseURL || "");
  if (!url || !model?.apiKey || !model?.model) {
    throw new Error("DashScope image provider is not configured.");
  }

  const content: Array<{ image: string } | { text: string }> = collectDashScopeInputImages(params)
    .map((image) => ({ image: imageFileToDataUrl(image) }))
    .filter((item) => item.image);
  content.push({ text: params.prompt || "" });

  return {
    url,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${model.apiKey}`,
    },
    body: {
      model: model.model,
      input: {
        messages: [
          {
            role: "user",
            content,
          },
        ],
      },
      parameters: buildDashScopeParameters(params),
    },
    isFormData: false,
  };
}

function normalizeDashScopeGenerationData(data: {
  output?: {
    choices?: Array<{
      message?: {
        content?: Array<{ image?: string; text?: string }>;
      };
    }>;
  };
  usage?: Record<string, unknown>;
  message?: string;
  error?: { message?: string };
} | null): ImageGenerationResult {
  const choices = Array.isArray(data?.output?.choices) ? data?.output?.choices || [] : [];
  const images = choices.flatMap((choice) => {
    const content = Array.isArray(choice?.message?.content) ? choice.message.content : [];
    return content
      .map((item) => item?.image || item?.text || "")
      .filter(Boolean)
      .map((item) => (String(item).startsWith("http") || String(item).startsWith("data:") ? { type: "url" as const, data: String(item) } : { type: "text" as const, data: String(item) }));
  });

  if (!images.length) {
    return {
      images: [{ type: "text", data: data?.error?.message || data?.message || "Invalid DashScope image response." }],
      usage: normalizeImageUsage(data?.usage),
      raw: data,
    };
  }

  return {
    images,
    usage: normalizeImageUsage(data?.usage),
    raw: data,
  };
}

export async function generateDashScopeImage(model: ImageProviderModel, params: ImageGenerationParams): Promise<ImageGenerationResult> {
  const request = buildDashScopeImageRequest(model, params);
  const res = await fetch(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(request.body),
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message = data?.error?.message || data?.message || `${res.status} ${res.statusText}`;
    return { images: [{ type: "text", data: message }], usage: normalizeImageUsage(data?.usage), raw: data };
  }

  return normalizeDashScopeGenerationData(data);
}
