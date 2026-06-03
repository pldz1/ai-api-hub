import store from "@/store/index";
import { dsAlert, getUuid } from "@/utils";
import { tr } from "@/i18n";
import type { ChatPromptMessage } from "@/types";
import { deleteMessage as deleteChatMessage } from "../conversation";
import { renderAssistantDraft } from "./message-renderer";
import type { StreamDraft } from "./stream-state";
import {
  type MessageElementActions,
  createUserMessageElement,
  createAssistantMessageElement,
  createAssistantDraftElement,
  insertReasoningElem,
  findMessageIndex,
} from "./message-elements";

/**
 * DOM renderer for the chat message area.
 *
 * Conversation requests are driven by the runner; this module renders stored
 * messages and live draft state into a container element.
 */
export interface ChatDrawer {
  init(container: HTMLElement | null): void;
  renderConversation(messages: ChatPromptMessage[], options?: { reset?: boolean }): void;
  updateDraftContent(draft: StreamDraft, messageId: string, isError?: boolean): boolean;
  syncDraftAssistant(runtime: Record<string, unknown>): boolean;
  removeTempAssistantElem(): void;
  clearDraftWorkingIcon(): void;
  deleteMessage(mid: string): Promise<void>;
  removeAllElem(): void;
  getMessageElement(mid: string): HTMLElement | null;
  onAfterRender: (() => void) | null;
  onMessageDeleted: (() => void | Promise<void>) | null;
}

export function createChatDrawer(): ChatDrawer {
  let container: HTMLElement | null = null;
  let draftContentEl: HTMLDivElement | null = null;
  let draftReasoningEl: HTMLDivElement | null = null;
  let draftMessageId = "";
  let draftContent = "";
  let draftReasoning = "";
  let renderPending = false;
  let _onAfterRender: (() => void) | null = null;
  let _onMessageDeleted: (() => void | Promise<void>) | null = null;

  const actions: MessageElementActions = {
    onPreviewImage: async (url) => {
      await store.dispatch("setModalImage", url);
      (document.getElementById("global_image_preview_modal") as HTMLDialogElement | null)?.showModal();
    },
    onCopyAssistantMessage: async (mid) => {
      const idx = findMessageIndex(container!, mid);
      if (idx < 0) {
        console.error("Failed to find message:", mid);
        dsAlert({ type: "error", message: tr("toast.invalidMessage") });
        return;
      }
      const msg = store.state.messages[idx];
      navigator.clipboard
        .writeText(msg.content[0].text)
        .then(() => dsAlert({ type: "success", message: tr("toast.messageCopySuccess") }))
        .catch((err) => {
          console.error("Failed to copy message:", err);
          dsAlert({ type: "error", message: tr("toast.messageCopyFailed", { error: String(err) }) });
        });
    },
    onDeleteMessage: async (mid) => {
      await _deleteMessage(mid);
    },
  };

  // === internal helpers ===

  function getMessageElement(mid: string): HTMLElement | null {
    if (!container) return null;
    return (Array.from(container.children).find((child) => child instanceof HTMLElement && child.id === mid) as HTMLElement) || null;
  }

  function createStoredMessageElement(message: ChatPromptMessage): HTMLElement | null {
    if (!message.mid) message.mid = getUuid("msg");
    if (!container) return null;

    if (message.role === "user") {
      return createUserMessageElement(container, message.content, message.mid, actions);
    }
    if (message.role === "assistant") {
      return createAssistantMessageElement(
        container,
        message.content,
        message.reasoning_content,
        message.mid,
        actions,
        Boolean(message.meta?.isContextBlocked),
      );
    }
    return null;
  }

  function markDraftElement(): void {
    const el = draftContentEl?.closest(".chat-md-bubble-assistant") as HTMLElement | null;
    if (el) el.dataset.chatDraft = "true";
  }

  function clearDraftWorkingIcon(): void {
    draftContentEl?.closest(".chat-md-bubble-assistant")?.querySelector(".cmba-assistant-icon")?.replaceChildren();
  }

  function removeTempAssistantElem(): void {
    const assistantEl = draftContentEl?.closest(".chat-md-bubble-assistant");
    if (assistantEl) assistantEl.remove();
    draftContentEl = null;
    draftReasoningEl = null;
  }

  function resetDraftState(): void {
    draftMessageId = "";
    draftContent = "";
    draftReasoning = "";
  }

  function renderAssStream(): void {
    if (draftContent || draftReasoning) clearDraftWorkingIcon();

    draftReasoningEl = renderAssistantDraft(
      { contentEl: draftContentEl, reasoningEl: draftReasoningEl },
      { content: draftContent, reasoning_content: draftReasoning },
      () => insertReasoningElem(draftContentEl!),
    );
  }

  async function _deleteMessage(mid: string): Promise<void> {
    const idx = findMessageIndex(container!, mid);
    if (idx < 0) {
      console.error("Failed to find message:", mid);
      dsAlert({ type: "error", message: tr("toast.invalidMessage") });
      return;
    }
    await store.dispatch("spliceMessages", idx);
    getMessageElement(mid)?.remove();
    await deleteChatMessage(store.state.curChatId, mid);
    await _onMessageDeleted?.();
  }

  function removeAllElem(): void {
    draftContentEl = null;
    draftReasoningEl = null;
    resetDraftState();
    container?.replaceChildren();
  }

  // === public API ===

  function init(el: HTMLElement | null): void {
    container = el;
  }

  function renderConversation(messages: ChatPromptMessage[] = [], options: { reset?: boolean } = {}): void {
    if (options.reset) {
      removeAllElem();
      messages.forEach((m) => createStoredMessageElement(m));
      return;
    }
    if (!container) return;

    const targetIds = new Set<string>();
    for (const m of messages) {
      if (!m.mid) m.mid = getUuid("msg");
      targetIds.add(m.mid);
    }

    const existingById = new Map<string, HTMLElement>();
    Array.from(container.children).forEach((child) => {
      if (!(child instanceof HTMLElement)) return;
      if (child.dataset.chatDraft === "true") {
        existingById.set(child.id, child);
        return;
      }
      if (!targetIds.has(child.id)) {
        child.remove();
        return;
      }
      existingById.set(child.id, child);
    });

    messages.forEach((message, index) => {
      let el = existingById.get(message.mid) || null;
      if (el?.dataset.chatDraft === "true") {
        draftContentEl = null;
        draftReasoningEl = null;
        el.remove();
        el = null;
      }
      el = el || createStoredMessageElement(message);
      if (!el) return;

      const currentAtIndex = container!.children[index] || null;
      if (currentAtIndex !== el) {
        container!.insertBefore(el, currentAtIndex);
      }
    });
  }

  function updateDraftContent(draft: StreamDraft, messageId: string, isError?: boolean): boolean {
    const isNew = !draftContentEl || draftMessageId !== messageId;

    if (isNew) {
      removeTempAssistantElem();
      resetDraftState();
      draftMessageId = messageId;
      draftContentEl = container ? createAssistantDraftElement(container, messageId) : null;
      markDraftElement();
      draftReasoningEl = null;
    }

    draftContent = draft.content;
    draftReasoning = draft.reasoning_content;

    if (isError !== undefined) {
      const assistantEl = draftContentEl?.closest(".chat-md-bubble-assistant");
      if (assistantEl) assistantEl.classList.toggle("is-error", isError);
    }

    if (!renderPending) {
      renderPending = true;
      requestAnimationFrame(() => {
        renderAssStream();
        _onAfterRender?.();
        renderPending = false;
      });
    }

    return isNew;
  }

  function syncDraftAssistant(runtime: Record<string, unknown> = {}): boolean {
    const dContent = String(runtime?.draftAssistantContent || "");
    const dReasoning = String(runtime?.draftReasoningContent || "");
    const dMid = String(runtime?.draftMessageId || "");
    const hasDraft = Boolean(dMid || dContent || dReasoning || runtime?.pending);

    if (!hasDraft) {
      removeTempAssistantElem();
      return false;
    }

    const storedDraftEl = dMid ? getMessageElement(dMid) : null;
    if (storedDraftEl && storedDraftEl.dataset.chatDraft !== "true") {
      draftContentEl = null;
      draftReasoningEl = null;
      return false;
    }

    const isNew = !draftContentEl || draftMessageId !== dMid;

    if (isNew) {
      removeTempAssistantElem();
      resetDraftState();
      draftMessageId = dMid;
      draftContentEl = container ? createAssistantDraftElement(container, dMid) : null;
      markDraftElement();
      draftReasoningEl = null;

      draftContent = dContent;
      draftReasoning = dReasoning;
      renderAssStream();
    }

    const assistantEl = draftContentEl?.closest(".chat-md-bubble-assistant");
    if (assistantEl) {
      const isErrorStatus = String(runtime?.status || "") === "error";
      assistantEl.classList.toggle("is-error", isErrorStatus);
    }

    return isNew;
  }

  return {
    init,
    renderConversation,
    updateDraftContent,
    syncDraftAssistant,
    removeTempAssistantElem,
    clearDraftWorkingIcon,
    deleteMessage: _deleteMessage,
    removeAllElem,
    getMessageElement,
    get onAfterRender() {
      return _onAfterRender;
    },
    set onAfterRender(v) {
      _onAfterRender = v;
    },
    get onMessageDeleted() {
      return _onMessageDeleted;
    },
    set onMessageDeleted(v) {
      _onMessageDeleted = v;
    },
  };
}
