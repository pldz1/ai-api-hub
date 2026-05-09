import { OpenAIClient } from "./openai";
import type { ChatCallback, PackedChatMessage } from "@/services/types";

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
  async chat(messages: PackedChatMessage[], params: Record<string, unknown> = {}, callback: ChatCallback | null = null): Promise<void> {
    await super.chat(flattenLegacyMessages(messages), { ...params, stream: true }, callback);
  }
}
