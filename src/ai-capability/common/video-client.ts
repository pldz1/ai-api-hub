import type { VideoGenerationParams, VideoGenerationResult } from "../video/types";
import { normalizeVideoUsage } from "./usage";
import type { JsonObject } from "./types";

// -- shared helpers -------------------------------------------------------

export const VIDEO_PROVIDER_NOT_READY_MESSAGE = "Video provider is not configured.";

// -- abstract base class --------------------------------------------------

export abstract class BaseVideoClient {
  baseURL = "";
  apiKey = "";
  model = "";
  useProxy = false;

  /** Whether the provider uses DashScope-style async task submission.
   *  When false, `generate()` expects a direct (synchronous) response and
   *  skips the polling loop entirely. */
  protected useAsyncTask = true;

  /** Milliseconds between task status poll requests. */
  protected pollIntervalMs = 15000;

  /** Maximum poll attempts before timing out. */
  protected maxPollAttempts = 80;

  constructor(baseURL: string, apiKey: string, model: string, useProxy = false) {
    this.init(baseURL, apiKey, model, useProxy);
  }

  // -- lifecycle -----------------------------------------------------------

  init(baseURL: string, apiKey: string, model: string, useProxy = false): void {
    this.baseURL = baseURL;
    this.apiKey = apiKey;
    this.model = model;
    this.useProxy = useProxy;
  }

  update(baseURL: string, apiKey: string, model: string, useProxy = false): void {
    if (baseURL !== this.baseURL || apiKey !== this.apiKey || model !== this.model || useProxy !== this.useProxy) {
      this.init(baseURL, apiKey, model, useProxy);
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

  getHeaders(): Record<string, string> {
    return {
      authorization: `Bearer ${this.apiKey}`,
      "content-type": "application/json",
    };
  }

  // -- abstract (subclass contract) ----------------------------------------

  abstract getUrl(params: VideoGenerationParams): string;
  abstract getBody(params: VideoGenerationParams): { body: Record<string, unknown>; isFormData: boolean };

  /** Extract the polling URL from the async task submission response.
   *  Only called when `useAsyncTask` is true. */
  abstract getFetchUrl(submitData: JsonObject): string;

  /** Parse the final result. Called for both async (from poll response)
   *  and sync (from the direct POST response) paths. */
  abstract responseFromTaskResult(data: JsonObject): VideoGenerationResult;

  // -- template method -----------------------------------------------------

  async generate(params: VideoGenerationParams, onStatusUpdate?: (status: string) => void): Promise<VideoGenerationResult> {
    if (!this.isConfigured()) {
      return {
        videos: [{ type: "text", data: VIDEO_PROVIDER_NOT_READY_MESSAGE }],
        usage: normalizeVideoUsage(),
      };
    }

    // ---- step 1: submit task ----
    const url = this.getUrl(params);
    const { body } = this.getBody(params);
    const headers: Record<string, string> = { ...this.getHeaders() };
    if (this.useAsyncTask) headers["X-DashScope-Async"] = "enable";

    const submitRes = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const submitData = await submitRes.json().catch(() => null);

    if (!submitRes.ok) {
      const message = submitData?.message || submitData?.error?.message || `${submitRes.status} ${submitRes.statusText}`;
      return {
        videos: [{ type: "text", data: message }],
        usage: normalizeVideoUsage(submitData?.usage),
        raw: submitData,
      };
    }

    // ---- sync path: response contains the result directly ----
    if (!this.useAsyncTask) {
      return this.responseFromTaskResult(submitData);
    }

    // ---- async path: poll for result ----
    let fetchUrl: string;
    try {
      fetchUrl = this.getFetchUrl(submitData);
    } catch {
      return {
        videos: [{ type: "text", data: "Video task submission succeeded but no task_id was returned." }],
        usage: normalizeVideoUsage(),
        raw: submitData,
      };
    }

    for (let attempt = 0; attempt < this.maxPollAttempts; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));

      const pollRes = await fetch(fetchUrl, {
        method: "GET",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
        },
      });
      const pollData = await pollRes.json().catch(() => null);

      if (!pollRes.ok) {
        const message = pollData?.message || pollData?.error?.message || `${pollRes.status} ${pollRes.statusText}`;
        return {
          videos: [{ type: "text", data: message }],
          usage: normalizeVideoUsage(pollData?.usage),
          raw: pollData,
        };
      }

      const status: string = (pollData?.output?.task_status || "").toUpperCase();

      if ((status === "PENDING" || status === "RUNNING") && onStatusUpdate) {
        onStatusUpdate(status);
      }

      if (status === "SUCCEEDED" || status === "FAILED") {
        return this.responseFromTaskResult(pollData);
      }
    }

    return {
      videos: [{ type: "text", data: "Video generation timed out. Please try again." }],
      usage: normalizeVideoUsage(),
      taskStatus: "FAILED",
    };
  }
}
