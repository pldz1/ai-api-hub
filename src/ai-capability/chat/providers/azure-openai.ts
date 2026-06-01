import { OpenAIClient } from "./openai";

/**
 * Azure OpenAI uses the same chat completions request shape as OpenAI here.
 * The distinct class keeps provider routing explicit while reusing the shared
 * endpoint/body/header behavior.
 */
export class AzureOpenAIClient extends OpenAIClient {
  constructor(baseURL: string, apiKey: string, model: string) {
    super(baseURL, apiKey, model);
  }
}
