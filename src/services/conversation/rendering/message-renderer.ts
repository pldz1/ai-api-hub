import { renderBlock } from "@/services/markdown/md-render";
import type { AssistantDraftContent } from "./assistant-stream-state";

export type AssistantDraftElements = {
  contentEl: HTMLDivElement | null;
  reasoningEl: HTMLDivElement | null;
};

export function renderAssistantDraft(
  elements: AssistantDraftElements,
  draft: AssistantDraftContent,
  ensureReasoningElement: () => HTMLDivElement | null,
  removeThinkingPlaceholder: () => void,
): HTMLDivElement | null {
  if (!elements.contentEl) return elements.reasoningEl;

  let reasoningEl = elements.reasoningEl;
  if (draft.reasoning_content) {
    reasoningEl = reasoningEl || ensureReasoningElement();
    if (reasoningEl) {
      removeThinkingPlaceholder();
      renderBlock("markdown-content", reasoningEl, draft.reasoning_content);
    }
  }

  if (draft.content) {
    renderBlock("markdown-content", elements.contentEl, draft.content);
  }

  return reasoningEl;
}
