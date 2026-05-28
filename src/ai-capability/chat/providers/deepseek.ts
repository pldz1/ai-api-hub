import { OpenAIClient } from "./openai";
import type { ChatCallback, ChatCompletionParams, ChatRequestOptions, PackedChatMessage } from "../types";

function flattenLegacyMessages(messages: PackedChatMessage[]): PackedChatMessage[] {
  return messages.map((item) => {
    if (typeof item.content === "string") return item;

    return {
      role: item.role,
      content: item.content?.[0]?.type === "text" ? item.content[0].text || "" : "",
    };
  });
}

export class DeepSeekClient extends OpenAIClient {
  async chat(
    messages: PackedChatMessage[],
    params: ChatCompletionParams = {},
    callback: ChatCallback | null = null,
    options: ChatRequestOptions = {},
  ): Promise<void> {
    await super.chat(flattenLegacyMessages(messages), params, callback, options);
  }
}
