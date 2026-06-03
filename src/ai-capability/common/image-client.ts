import type { ImageGenerationParams, ImageGenerationResult } from "../image/types";
import { normalizeImageUsage } from "./usage";
import type { JsonObject } from "./types";

// -- shared helpers -------------------------------------------------------

export const IMAGE_PROVIDER_NOT_READY_MESSAGE = "Image provider is not configured.";

// -- abstract base class --------------------------------------------------

/**
 * Abstract base for image provider clients.
 *
 * Subclasses implement three hook points that capture everything
 * provider-specific (URL shape, request body, response parsing).
 * The template method (generate) and lifecycle (init / update / destroy /
 * isConfigured) live here once.
 */
export abstract class BaseImageClient {
  baseURL = "";
  apiKey = "";
  model = "";

  constructor(baseURL: string, apiKey: string, model: string) {
    this.init(baseURL, apiKey, model);
  }

  // -- lifecycle -----------------------------------------------------------

  init(baseURL: string, apiKey: string, model: string): void {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
    this.model = model;
  }

  update(baseURL: string, apiKey: string, model: string): void {
    if (baseURL !== this.baseURL || apiKey !== this.apiKey || model !== this.model) {
      this.init(baseURL, apiKey, model);
    }
  }

  destroy(): void {
    this.baseURL = "";
    this.apiKey = "";
    this.model = "";
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.model);
  }

  // -- utility -------------------------------------------------------------

  protected trimTrailingSlash(value: string = ""): string {
    return String(value || "").replace(/\/+$/, "");
  }

  // -- overridable ---------------------------------------------------------

  getHeaders(_isFormData?: boolean): Record<string, string> {
    return {
      authorization: `Bearer ${this.apiKey}`,
      "content-type": "application/json",
    };
  }

  // -- abstract (subclass contract) ----------------------------------------

  abstract getUrl(params: ImageGenerationParams): string;
  abstract getBody(params: ImageGenerationParams): { body: Record<string, unknown> | FormData; isFormData: boolean };
  abstract responseFromCompletion(data: JsonObject): ImageGenerationResult;

  // -- template method -----------------------------------------------------

  async generate(params: ImageGenerationParams): Promise<ImageGenerationResult> {
    if (!this.isConfigured()) {
      return {
        images: [{ type: "text", data: IMAGE_PROVIDER_NOT_READY_MESSAGE }],
        usage: normalizeImageUsage(),
      };
    }

    const url = this.getUrl(params);
    if (!url) {
      return {
        images: [{ type: "text", data: "Image provider URL is not configured." }],
        usage: normalizeImageUsage(),
      };
    }

    const { body, isFormData } = this.getBody(params);
    const headers = this.getHeaders(isFormData);

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: isFormData ? (body as FormData) : JSON.stringify(body),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const message = data?.error?.message || data?.message || `${res.status} ${res.statusText}`;
      return {
        images: [{ type: "text", data: message }],
        usage: normalizeImageUsage(data?.usage),
        raw: data,
      };
    }

    return this.responseFromCompletion(data);
  }
}
