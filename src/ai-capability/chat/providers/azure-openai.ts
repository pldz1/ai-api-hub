import { OpenAIClient } from "./openai";

const DEFAULT_BASE_URL = "https://api.openai.com/v1/chat/completions";

export class AzureOpenAIClient extends OpenAIClient {
  getHeaders(): Record<string, string> {
    if (this.apiKey.startsWith("Bearer ")) {
      return {
        authorization: this.apiKey,
      };
    }

    return {
      "api-key": this.apiKey,
    };
  }

  getUrl(): string {
    return this.baseURL || DEFAULT_BASE_URL;
  }
}
