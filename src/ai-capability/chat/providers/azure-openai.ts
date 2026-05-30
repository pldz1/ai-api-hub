import type { ChatCompletionParams, PackedChatMessage } from "../types";
import type { JsonObject } from "../../common";
import { OpenAIClient } from "./openai";

function trimTrailingSlash(value = ""): string {
  return String(value || "").replace(/\/+$/, "");
}

function appendApiVersion(url: string, apiVersion: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}api-version=${encodeURIComponent(apiVersion)}`;
}

export class AzureOpenAIClient extends OpenAIClient {
  endpoint = "";
  deployment = "";
  apiVersion = "";

  constructor(endpoint: string, apiKey: string, deployment: string, apiVersion: string) {
    super(endpoint, apiKey, deployment);
    this.init(endpoint, apiKey, deployment, apiVersion);
  }

  init(endpoint: string, apiKey: string, deployment: string, apiVersion: string = ""): void {
    this.baseURL = endpoint;
    this.endpoint = endpoint;
    this.apiKey = apiKey;
    this.model = deployment;
    this.deployment = deployment;
    this.apiVersion = apiVersion;
  }

  update(endpoint: string, apiKey: string, deployment: string, apiVersion: string = ""): void {
    if (endpoint !== this.endpoint || apiKey !== this.apiKey || deployment !== this.deployment || apiVersion !== this.apiVersion) {
      this.init(endpoint, apiKey, deployment, apiVersion);
    }
  }

  destroy(): void {
    super.destroy();
    this.endpoint = "";
    this.deployment = "";
    this.apiVersion = "";
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.deployment && this.apiVersion);
  }

  getHeaders(): Record<string, string> {
    return {
      "api-key": this.apiKey,
    };
  }

  getChatCompletionsUrl(): string {
    const path = `${trimTrailingSlash(this.endpoint)}/openai/deployments/${encodeURIComponent(this.deployment)}/chat/completions`;
    return appendApiVersion(path, this.apiVersion);
  }

  getResponsesUrl(): string {
    const path = `${trimTrailingSlash(this.endpoint)}/openai/v1/responses`;
    return appendApiVersion(path, this.apiVersion);
  }

  getChatCompletionsBody(messages: PackedChatMessage[], params: ChatCompletionParams = {}, stream = true): JsonObject {
    return {
      messages,
      ...this.getChatCompletionParams(params, stream),
      stream,
    };
  }
}
