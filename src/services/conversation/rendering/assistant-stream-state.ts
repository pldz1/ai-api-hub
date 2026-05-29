import type { ChatProviderResponse } from "@/ai-capability";
import type { ChatResponseDelta, TokenUsage } from "@/types";

export type AssistantDraftContent = {
  content: string;
  reasoning_content: string;
};

export function adaptProviderResponse(response: ChatProviderResponse): ChatResponseDelta | null {
  if (response.flag === false) {
    return { kind: "error", message: String(response.content || "") };
  }
  if (response.usage) {
    return { kind: "usage", usage: response.usage };
  }
  if (!response.content && !response.reasoning_content) {
    return null;
  }
  return { kind: "text", content: response.content, reasoning_content: response.reasoning_content };
}

export class AssistantStreamState {
  messageId = "";
  content: AssistantDraftContent = { content: "", reasoning_content: "" };
  tokenUsage: TokenUsage | null = null;
  hasError = false;
  lastError = "";
  forceStopped = false;

  reset(messageId: string = ""): void {
    this.messageId = messageId;
    this.content = { content: "", reasoning_content: "" };
    this.tokenUsage = null;
    this.hasError = false;
    this.lastError = "";
    this.forceStopped = false;
  }

  append(delta: Partial<AssistantDraftContent> = {}): void {
    this.content.content += delta.content || "";
    this.content.reasoning_content += delta.reasoning_content || "";
  }

  applyDelta(delta: ChatResponseDelta): void {
    switch (delta.kind) {
      case "usage":
        this.tokenUsage = delta.usage;
        break;
      case "error":
        this.markError(delta.message);
        break;
      case "text":
        this.append({ content: delta.content, reasoning_content: delta.reasoning_content });
        this.lastError = "";
        break;
    }
  }

  markError(error: string = ""): void {
    this.hasError = true;
    this.lastError = error;
  }

  stop(): void {
    this.forceStopped = true;
  }

  hasContent(): boolean {
    return Boolean(this.content.content || this.content.reasoning_content);
  }
}
