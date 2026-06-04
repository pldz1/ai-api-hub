import { OpenAIImageClient } from "./openai";

/**
 * Azure OpenAI image client.
 *
 * Extends the standard OpenAI image client, overriding only the default
 * base URL (Azure deployment endpoint placeholder) and authentication
 * headers to support both `api-key` and Bearer token authentication.
 */
export class AzureOpenAIImageClient extends OpenAIImageClient {
  protected getDefaultBaseURL(): string {
    return "https://<YOUR-DEPLOYMENT-NAME>.openai.com/v1";
  }

  getHeaders(isFormData?: boolean): Record<string, string> {
    if (this.apiKey.startsWith("Bearer ")) {
      return {
        accept: "application/json",
        authorization: this.apiKey,
        ...(!isFormData ? { "content-type": "application/json" } : {}),
      };
    }
    return {
      accept: "application/json",
      "api-key": this.apiKey,
      ...(!isFormData ? { "content-type": "application/json" } : {}),
    };
  }
}
