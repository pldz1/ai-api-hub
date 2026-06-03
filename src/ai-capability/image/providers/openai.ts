import { BaseImageClient } from "../../common/image-client";
import { normalizeImageUsage } from "../../common/usage";
import type { JsonObject } from "../../common";
import type { ImageGenerationParams, ImageGenerationResult, ImageParamValue } from "../types";

// -- constants -------------------------------------------------------------

const DEFAULT_IMAGE_QUALITY = "auto";
const DEFAULT_IMAGE_OUTPUT_FORMAT = "png";

const IMAGE_OPERATION_ENDPOINT = {
  create: "generations",
  edit: "edits",
};

const INVALID_IMAGE_RESPONSE_MESSAGE = "Invalid image response.";
const EMPTY_IMAGE_RESPONSE_ITEM_MESSAGE = "Empty image response item.";

const RESERVED_IMAGE_PARAM_KEYS = ["prompt", "size", "n", "quality", "outputFormat", "attachments"];

type ImageRequestBody = Record<string, ImageParamValue>;

// -- helpers ---------------------------------------------------------------

function isImageParamValue(value: unknown): value is { filename: string; content_type: string; data: string } {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { filename?: unknown; content_type?: unknown; data?: unknown };
  return Boolean(candidate.filename && candidate.content_type && candidate.data);
}

function base64ToBlob(base64Data: string, contentType: string = "image/png"): Blob {
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

function hasImageInput(params: ImageRequestBody = {}): boolean {
  return Object.values(params || {}).some((value) => isImageParamValue(value));
}

function appendFormDataValue(formData: FormData, key: string, value: ImageParamValue): void {
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

function buildImageFormData(body: ImageRequestBody = {}, options: { omitModel?: boolean } = {}): FormData {
  const formData = new FormData();

  Object.entries(body).forEach(([key, value]) => {
    if (options.omitModel && key === "model") return;
    appendFormDataValue(formData, key, value as ImageParamValue);
  });

  return formData;
}

function buildImageRequestBody(
  modelId: string | undefined,
  params: ImageGenerationParams,
  options: { omitModel?: boolean } = {},
): { body: ImageRequestBody; hasInputImage: boolean } {
  const prompt = params?.prompt || "";
  const size = params?.size || "1024x1024";
  const n = params?.n || 1;
  const quality = params?.quality || DEFAULT_IMAGE_QUALITY;
  const outputFormat = params?.outputFormat || DEFAULT_IMAGE_OUTPUT_FORMAT;
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
    ...(!options.omitModel && modelId ? { model: modelId } : {}),
    ...extraParams,
  };

  return { body, hasInputImage: hasImageInput(body) };
}

function normalizeImageGenerationData(
  data: {
    data?: Array<{ url?: string; b64_json?: string; error?: { message?: string } }>;
    error?: { message?: string };
    message?: string;
    usage?: Record<string, unknown>;
  } | null,
): ImageGenerationResult {
  if (!Array.isArray(data?.data)) {
    const message = data?.error?.message || data?.message || JSON.stringify(data);
    return {
      images: [{ type: "text", data: message || INVALID_IMAGE_RESPONSE_MESSAGE }],
      usage: normalizeImageUsage(data?.usage),
      raw: data,
    };
  }

  const images = data.data.map((item): { type: "url" | "text"; data: string } => {
    if (item?.url) return { type: "url", data: item.url };
    if (item?.b64_json) return { type: "url", data: `data:image/png;base64,${item.b64_json}` };
    return { type: "text", data: item?.error?.message || EMPTY_IMAGE_RESPONSE_ITEM_MESSAGE };
  });

  return { images, usage: normalizeImageUsage(data?.usage), raw: data };
}

// -- client ----------------------------------------------------------------

export class OpenAIImageClient extends BaseImageClient {
  protected getDefaultBaseURL(): string {
    return "https://api.openai.com/v1";
  }

  protected resolveEndpointUrl(url: string, hasInputImage: boolean): string {
    const trimmedUrl = url.trim();
    if (!hasInputImage) return trimmedUrl;
    return trimmedUrl.replace(/\/images\/generations(?=($|[?#]))/, `/images/${IMAGE_OPERATION_ENDPOINT.edit}`);
  }

  protected buildEndpointUrl(baseURL: string, hasInputImage: boolean): string {
    const trimmedUrl = this.trimTrailingSlash(baseURL);
    const endpoint = hasInputImage ? IMAGE_OPERATION_ENDPOINT.edit : IMAGE_OPERATION_ENDPOINT.create;

    if (/\/images\/(generations|edits)(?=($|[?#]))/.test(trimmedUrl)) {
      return this.resolveEndpointUrl(trimmedUrl, hasInputImage);
    }

    return `${trimmedUrl}/images/${endpoint}`;
  }

  getUrl(params: ImageGenerationParams): string {
    const { hasInputImage } = buildImageRequestBody(this.model, params);
    return this.buildEndpointUrl(this.baseURL || this.getDefaultBaseURL(), hasInputImage);
  }

  getBody(params: ImageGenerationParams): { body: Record<string, unknown> | FormData; isFormData: boolean } {
    const { body, hasInputImage } = buildImageRequestBody(this.model, params);

    return {
      body: hasInputImage ? buildImageFormData(body) : body,
      isFormData: hasInputImage,
    };
  }

  getHeaders(isFormData?: boolean): Record<string, string> {
    return {
      accept: "application/json",
      authorization: `Bearer ${this.apiKey}`,
      ...(!isFormData ? { "content-type": "application/json" } : {}),
    };
  }

  responseFromCompletion(data: JsonObject): ImageGenerationResult {
    return normalizeImageGenerationData(data as Parameters<typeof normalizeImageGenerationData>[0]);
  }
}
