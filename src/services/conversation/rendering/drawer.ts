import store from "@/store/index";
import { dsAlert, getUuid } from "@/utils";
import { tr } from "@/i18n";
import type { ChatPromptMessage } from "@/types";
import { deleteMessage as deleteChatMessage } from "../conversation";
import { ChatMessageElementFactory } from "./message-elements";
import { AssistantStreamState } from "./assistant-stream-state";
import { renderAssistantDraft } from "./message-renderer";

/**
 * DOM renderer for the chat message area.
 *
 * Conversation requests are driven by `ChatSessionRunner`; this class is
 * responsible for rendering stored messages and live draft state.
 */
export class ChatDrawer extends ChatMessageElementFactory {
  declare container: HTMLElement | null;
  assistantStream: AssistantStreamState;
  assistantDraftContentEl: HTMLDivElement | null;
  assistantDraftReasoningEl: HTMLDivElement | null;
  private _renderPending: boolean;
  onAfterRender: (() => void) | null = null;
  onMessageDeleted: (() => void | Promise<void>) | null = null;

  constructor() {
    super();

    this.assistantStream = new AssistantStreamState();
    this.assistantDraftContentEl = null;
    this.assistantDraftReasoningEl = null;
    this._renderPending = false;

    this.setMessageActions({
      onPreviewImage: async (url: string) => {
        await store.dispatch("setModalImage", url);
        (document.getElementById("global_image_preview_modal") as HTMLDialogElement | null)?.showModal();
      },
      onCopyAssistantMessage: async (mid: string) => {
        const index = this.findMessageIndex(mid);
        if (index < 0) {
          console.error("Failed to find message:", mid);
          dsAlert({ type: "error", message: tr("toast.invalidMessage") });
          return;
        }

        const message = store.state.messages[index];
        navigator.clipboard
          .writeText(message.content[0].text)
          .then(() => dsAlert({ type: "success", message: tr("toast.messageCopySuccess") }))
          .catch((err) => {
            console.error("Failed to copy message:", err);
            dsAlert({ type: "error", message: tr("toast.messageCopyFailed", { error: String(err) }) });
          });
      },
      onDeleteMessage: async (mid: string) => {
        await this.deleteMessage(mid);
      },
    });
  }

  init(container: HTMLElement | null): void {
    this.container = container;
  }

  async deleteMessage(mid: string): Promise<void> {
    const index = this.findMessageIndex(mid);
    if (index < 0) {
      console.error("Failed to find message:", mid);
      dsAlert({ type: "error", message: tr("toast.invalidMessage") });
      return;
    }

    await store.dispatch("spliceMessages", index);
    const target = this.getMessageElement(mid);
    if (target) target.remove();
    await deleteChatMessage(store.state.curChatId, mid);
    await this.onMessageDeleted?.();
  }

  clearDraftWorkingIcon(): void {
    const assistantEl = this.assistantDraftContentEl?.closest(".chat-md-bubble-assistant");
    const iconEl = assistantEl?.querySelector(".cmba-assistant-icon");
    if (iconEl) {
      iconEl.replaceChildren();
    }
  }

  removeTempAssistantElem(): void {
    const assistantEl = this.assistantDraftContentEl?.closest(".chat-md-bubble-assistant");
    if (assistantEl) assistantEl.remove();
    this.assistantDraftContentEl = null;
    this.assistantDraftReasoningEl = null;
  }

  getMessageElement(mid: string): HTMLElement | null {
    if (!this.container) return null;
    return (Array.from(this.container.children).find((child) => child instanceof HTMLElement && child.id === mid) as HTMLElement) || null;
  }

  createStoredMessageElement(message: ChatPromptMessage): HTMLElement | null {
    if (!message.mid) message.mid = getUuid("msg");

    if (message.role === "user") {
      return this.createUserMessageElement(message.content, message.mid);
    }

    if (message.role === "assistant") {
      return this.createAssistantMessageElement(message.content, message?.reasoning_content, message.mid, Boolean(message.meta?.isContextBlocked));
    }

    return null;
  }

  markDraftAssistantElement(): void {
    const assistantEl = this.assistantDraftContentEl?.closest(".chat-md-bubble-assistant") as HTMLElement | null;
    if (assistantEl) assistantEl.dataset.chatDraft = "true";
  }

  renderConversation(messages: ChatPromptMessage[] = [], options: { reset?: boolean } = {}): void {
    if (options.reset) {
      this.removeAllElem();
      messages.forEach((message) => this.createStoredMessageElement(message));
      return;
    }

    if (!this.container) return;

    const targetIds = new Set<string>();
    for (const message of messages) {
      if (!message.mid) message.mid = getUuid("msg");
      targetIds.add(message.mid);
    }

    const existingById = new Map<string, HTMLElement>();
    Array.from(this.container.children).forEach((child) => {
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
      let messageEl = existingById.get(message.mid) || null;

      if (messageEl?.dataset.chatDraft === "true") {
        this.assistantDraftContentEl = null;
        this.assistantDraftReasoningEl = null;
        messageEl?.remove();
        messageEl = null;
      }

      messageEl = messageEl || this.createStoredMessageElement(message);
      if (!messageEl) return;

      const currentAtIndex = this.container.children[index] || null;
      if (currentAtIndex !== messageEl) {
        this.container.insertBefore(messageEl, currentAtIndex);
      }
    });
  }

  updateDraftContent(draft: { content: string; reasoning_content: string }, messageId: string, isError?: boolean): void {
    if (!this.assistantDraftContentEl || this.assistantStream.messageId !== messageId) {
      this.removeTempAssistantElem();
      this.assistantStream.reset(messageId);
      this.assistantDraftContentEl = this.createAssistantDraftElement(messageId);
      this.markDraftAssistantElement();
      this.assistantDraftReasoningEl = null;
    }

    this.assistantStream.content = draft;
    if (isError !== undefined) {
      const assistantEl = this.assistantDraftContentEl?.closest(".chat-md-bubble-assistant");
      if (assistantEl) assistantEl.classList.toggle("is-error", isError);
    }

    if (!this._renderPending) {
      this._renderPending = true;
      requestAnimationFrame(() => {
        this.renderAssStream();
        this.onAfterRender?.();
        this._renderPending = false;
      });
    }
  }

  syncDraftAssistant(runtime: Record<string, unknown> = {}): void {
    const draft = {
      content: String(runtime?.draftAssistantContent || ""),
      reasoning_content: String(runtime?.draftReasoningContent || ""),
    };
    const draftMessageId = String(runtime?.draftMessageId || "");
    const hasDraft = Boolean(draftMessageId || draft.content || draft.reasoning_content || runtime?.pending);

    if (!hasDraft) {
      this.removeTempAssistantElem();
      return;
    }

    const storedDraftEl = draftMessageId ? this.getMessageElement(draftMessageId) : null;
    if (storedDraftEl && storedDraftEl.dataset.chatDraft !== "true") {
      this.assistantDraftContentEl = null;
      this.assistantDraftReasoningEl = null;
      return;
    }

    const isNewElement = !this.assistantDraftContentEl || this.assistantStream.messageId !== draftMessageId;

    if (isNewElement) {
      this.removeTempAssistantElem();
      this.assistantStream.reset(draftMessageId);
      this.assistantDraftContentEl = this.createAssistantDraftElement(this.assistantStream.messageId);
      this.markDraftAssistantElement();
      this.assistantDraftReasoningEl = null;

      this.assistantStream.content = draft;
      this.renderAssStream();
    }

    const assistantEl = this.assistantDraftContentEl?.closest(".chat-md-bubble-assistant");
    if (assistantEl) {
      const isErrorStatus = String(runtime?.status || "") === "error";
      assistantEl.classList.toggle("is-error", isErrorStatus);
    }
  }

  renderAssStream(): void {
    if (this.assistantStream.hasContent()) {
      this.clearDraftWorkingIcon();
    }

    this.assistantDraftReasoningEl = renderAssistantDraft(
      {
        contentEl: this.assistantDraftContentEl,
        reasoningEl: this.assistantDraftReasoningEl,
      },
      this.assistantStream.content,
      () => this.insertReasoningElem(this.assistantDraftContentEl),
    );
  }

  removeAllElem(): void {
    this.assistantDraftContentEl = null;
    this.assistantDraftReasoningEl = null;
    this.assistantStream.reset();
    if (!this.container) return;

    this.container.replaceChildren();
  }

}
