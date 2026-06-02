import { OpenAIClient } from "./openai";

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

  getResponsesUrl(): string {
    return this.baseURL || "https://<YOUR-AZURE-PROJECT>.openai.azure.com/openai/v1/responses";
  }
}
