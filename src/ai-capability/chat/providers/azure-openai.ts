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
}
