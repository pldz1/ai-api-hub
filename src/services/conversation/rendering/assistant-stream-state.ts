import type { ChatResponseDelta, TokenUsage } from "@/types";

export type AssistantDraftContent = {
  content: string;
  reasoning_content: string;
};

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
