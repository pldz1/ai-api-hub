import { renderBlock } from "@/services/markdown/md-render";
import type { AssistantDraftContent } from "./assistant-stream-state";

export type AssistantDraftElements = {
  contentEl: HTMLDivElement | null;
  reasoningEl: HTMLDivElement | null;
};

const _lastReasoning = new WeakMap<HTMLElement, string>();
const _lastContent = new WeakMap<HTMLElement, string>();

export function renderAssistantDraft(
  elements: AssistantDraftElements,
  draft: AssistantDraftContent,
  ensureReasoningElement: () => HTMLDivElement | null,
): HTMLDivElement | null {
  if (!elements.contentEl) return elements.reasoningEl;

  let reasoningEl = elements.reasoningEl;
  if (draft.reasoning_content) {
    reasoningEl = reasoningEl || ensureReasoningElement();
    if (reasoningEl) {
      if (_lastReasoning.get(reasoningEl) !== draft.reasoning_content) {
        renderBlock("markdown-content", reasoningEl, draft.reasoning_content);
        _lastReasoning.set(reasoningEl, draft.reasoning_content);
      }
    }
  }

  if (draft.content) {
    if (_lastContent.get(elements.contentEl) !== draft.content) {
      renderBlock("markdown-content", elements.contentEl, draft.content);
      _lastContent.set(elements.contentEl, draft.content);
    }
  }

  return reasoningEl;
}
