// @ts-nocheck
import store from "@/store/index";
import { ChatGateway } from "@/ai-capability";
import { dsAlert, getUuid } from "@/utils";
import { tr } from "@/i18n";
import type { ChatPromptContent, ChatPromptMessage, ChatResponseDelta } from "@/types";
import { addMessage, deleteMessage as deleteChatMessage } from "../conversation";
import { createChatTurnMessages, createChatRequest, getConversationMessageFormat, getConversationSystemPrompts } from "../runtime/chat-context";
import { ChatElemCreator } from "./message-elements";
import { AssistantStreamState } from "./assistant-stream-state";
import { renderAssistantDraft } from "./message-renderer";

/**
 * DOM renderer and legacy foreground chat runner for the chat message area.
 *
 * New conversation requests are normally driven by `ChatSessionRunner`; this
 * class remains responsible for rendering stored messages and live draft state.
 */
export class ChatDrawer extends ChatElemCreator {
  constructor(sync: boolean = false) {
    super(sync);

    this._isListenerActive = false;
    this.client = new ChatGateway();
    this.assistantStream = new AssistantStreamState();
    this.assistantDraftContentEl = null;
    this.assistantDraftReasoningEl = null;
    this.hasThinkingPlaceholder = false;
    this.renderQueue = [];
    this.isRendering = false;

    this.enqueueRender = this.enqueueRender.bind(this);
    this.processRenderQueue = this.processRenderQueue.bind(this);
    this.renderAssStream = this.renderAssStream.bind(this);
    this.draw = this.draw.bind(this);

    this.setMessageActions({
      onPreviewImage: async (url: string) => {
        await store.dispatch("setModalImage", url);
        global_image_preview_modal.showModal();
      },
      onCopyAssistantMessage: async (mid: string) => {
        const index = this.findMsgIndex(mid);
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

  init(id: string): void {
    this.id = id;
    this.container = document.getElementById(this.id);
    this.addListener();
  }

  chatClientInit(): void {
    this.client.init(createChatRequest().model);
  }

  async chat(data: ChatPromptMessage): Promise<void> {
    this.removeListener();
    const context = createChatRequest();
    this.client.init(context.model);
    this.assistantStream.reset();

    const userMessage = { ...data, mid: getUuid("msg") };
    this.draw([userMessage]);
    this.drawStreamAss();

    await store.dispatch("pushMessages", userMessage);
    if (this.sync) await addMessage(store.state.curChatId, userMessage.mid, userMessage);

    const passedMsgLen = store.state.curChatModelSettings.passedMsgLen;
    const history = store.state.messages.filter((msg) => !msg.meta?.isContextBlocked);
    const messages = history.slice(-Math.min(passedMsgLen, history.length));
    const packedMessages = createChatTurnMessages(messages, getConversationSystemPrompts(), getConversationMessageFormat(context.model));
    const request = {
      ...context,
      capabilities: messages[messages.length - 1]?.meta?.usedCapabilities || {},
    };

    await store.dispatch("setLlmRequestPending", true);
    const stream = this.client.chat(packedMessages, request);
    let next = await stream.next();
    while (!next.done) {
      this.enqueueRender(next.value);
      next = await stream.next();
    }
    const completed = Boolean(next.value);

    if (this.assistantStream.forceStopped) {
      await store.dispatch("setLlmRequestPending", false);
      return;
    }

    if (this.assistantStream.hasError) {
      await this.finalizeErroredAssistantDraft();
      this.addListener();
      await store.dispatch("setLlmRequestPending", false);
      return;
    }

    if (!completed) {
      this.removeTempAssistantElem();
      this.addListener();
      await store.dispatch("setLlmRequestPending", false);
      return;
    }

    await this.finalizeSuccessfulAssistantDraft();
    this.addListener();
    await store.dispatch("setLlmRequestPending", false);
  }

  stop(): void {
    this.assistantStream.stop();
    this.client.abort();
    this.assistantDraftContentEl = null;
    this.assistantDraftReasoningEl = null;
    this.renderQueue = [];
    this.isRendering = false;
    store.dispatch("setLlmRequestPending", false);
    this.addListener();
  }

  async deleteMessage(mid: string): Promise<void> {
    const index = this.findMsgIndex(mid);
    if (index < 0) {
      console.error("Failed to find message:", mid);
      dsAlert({ type: "error", message: tr("toast.invalidMessage") });
      return;
    }

    await store.dispatch("spliceMessages", index);
    const target = this.container?.querySelector(`#${CSS.escape(mid)}`);
    if (target) target.remove();
    await deleteChatMessage(store.state.curChatId, mid);
  }

  async finalizeErroredAssistantDraft(): Promise<void> {
    if (!this.assistantStream.hasContent()) {
      this.assistantStream.content.content = this.assistantStream.lastError || tr("toast.modelRequestFailed", { error: "" });
    }
    await this.persistAssistantDraft();
  }

  async finalizeSuccessfulAssistantDraft(): Promise<void> {
    if (!this.assistantStream.content.content) {
      this.forceRemoveResponsingEl();
      this.draw([
        {
          role: "assistant",
          content: [{ type: "text", text: tr("chat.timeoutNoContent") }],
          mid: getUuid("msg"),
        },
      ]);
      debugger;
      return;
    }

    await this.persistAssistantDraft();
  }

  async persistAssistantDraft(): Promise<void> {
    const assistantData = {
      role: "assistant",
      content: [{ type: "text", text: this.assistantStream.content.content }],
      reasoning_content: this.assistantStream.content.reasoning_content,
      mid: this.assistantStream.messageId,
      meta: {
        isContextBlocked: this.assistantStream.hasError || undefined,
      } as Record<string, unknown>,
    };
    if (this.assistantStream.tokenUsage) assistantData.token_usage = this.assistantStream.tokenUsage;

    await store.dispatch("pushMessages", assistantData);
    if (this.sync) await addMessage(store.state.curChatId, this.assistantStream.messageId, assistantData);
  }

  forceRemoveResponsingEl(): void {
    if (!this.hasThinkingPlaceholder || !this.container) return;

    const placeholder = this.container.querySelector(".markdown-p-text");
    if (placeholder) placeholder.remove();
    this.hasThinkingPlaceholder = false;
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
    this.hasThinkingPlaceholder = false;
  }

  draw(messages: ChatPromptMessage[]): void {
    for (const message of messages) {
      this.createStoredMessageElement(message);
    }
  }

  getMessageRenderKey(message: ChatPromptMessage): string {
    return JSON.stringify({
      role: message.role,
      content: message.content,
      reasoning_content: message.reasoning_content || "",
      isContextBlocked: Boolean(message.meta?.isContextBlocked),
    });
  }

  getMessageElement(mid: string): HTMLElement | null {
    if (!this.container) return null;
    return (Array.from(this.container.children).find((child) => child instanceof HTMLElement && child.id === mid) as HTMLElement) || null;
  }

  markStoredMessageElement(el: HTMLElement | null, message: ChatPromptMessage, renderKey: string): HTMLElement | null {
    if (!el) return null;
    el.dataset.chatMessage = "true";
    el.dataset.chatMessageRole = message.role;
    el.dataset.chatMessageKey = renderKey;
    delete el.dataset.chatDraft;
    return el;
  }

  createStoredMessageElement(message: ChatPromptMessage): HTMLElement | null {
    if (!message.mid) message.mid = getUuid("msg");

    const renderKey = this.getMessageRenderKey(message);

    if (message.role === "user") {
      return this.markStoredMessageElement(this.createUserMessageElement(message.content, message.mid), message, renderKey);
    }

    if (message.role === "assistant") {
      return this.markStoredMessageElement(
        this.createAssistantMessageElement(message.content, message?.reasoning_content, message.mid, Boolean(message.meta?.isContextBlocked)),
        message,
        renderKey,
      );
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
      this.draw(messages);
      return;
    }

    if (!this.container) return;

    const targetIds = new Set<string>();
    for (const message of messages) {
      if (!message.mid) message.mid = getUuid("msg");
      targetIds.add(message.mid);
    }

    Array.from(this.container.children).forEach((child) => {
      if (!(child instanceof HTMLElement)) return;
      if (child.dataset.chatDraft === "true") return;
      if (!targetIds.has(child.id)) child.remove();
    });

    messages.forEach((message, index) => {
      const renderKey = this.getMessageRenderKey(message);
      let messageEl = this.getMessageElement(message.mid);
      const canReuseMessageEl = messageEl?.dataset.chatDraft !== "true" && messageEl?.dataset.chatMessageKey === renderKey;

      if (!canReuseMessageEl) {
        if (messageEl?.dataset.chatDraft === "true") {
          this.assistantDraftContentEl = null;
          this.assistantDraftReasoningEl = null;
          this.hasThinkingPlaceholder = false;
        }
        messageEl?.remove();
        messageEl = this.createStoredMessageElement(message);
      }

      if (!messageEl) return;

      const currentAtIndex = this.container.children[index] || null;
      if (currentAtIndex !== messageEl) {
        this.container.insertBefore(messageEl, currentAtIndex);
      }
    });
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
      this.hasThinkingPlaceholder = false;
      return;
    }

    if (!this.assistantDraftContentEl || this.assistantStream.messageId !== draftMessageId) {
      this.removeTempAssistantElem();
      this.assistantStream.reset(draftMessageId);
      this.assistantDraftContentEl = this.createAssTempElem(this.assistantStream.messageId);
      this.markDraftAssistantElement();
      this.assistantDraftReasoningEl = null;
      this.hasThinkingPlaceholder = true;
    }

    this.assistantStream.content = draft;
    this.renderAssStream();

    const assistantEl = this.assistantDraftContentEl?.closest(".chat-md-bubble-assistant");
    if (assistantEl) {
      const isErrorStatus = String(runtime?.status || "") === "error";
      assistantEl.classList.toggle("is-error", isErrorStatus);
    }
  }

  enqueueRender(delta: ChatResponseDelta): void {
    if (this.assistantStream.forceStopped) return;

    store.dispatch("setLlmRequestPending", false);

    if (delta.kind === "error") {
      this.renderQueue = [];
      this.isRendering = false;
      this.assistantStream.applyDelta(delta);

      const assistantEl = this.assistantDraftContentEl?.closest(".chat-md-bubble-assistant");
      if (assistantEl) assistantEl.classList.add("is-error");

      if (this.assistantDraftContentEl && this.assistantStream.hasContent()) this.renderAssStream();
      else this.forceRemoveResponsingEl();

      console.error("Failed to render assistant stream:", delta.message);
      dsAlert({ type: "error", message: delta.message, duration: 10000 });
      return;
    }

    this.assistantStream.applyDelta(delta);

    this.renderQueue.push("");
    if (!this.isRendering) {
      this.isRendering = true;
      this.processRenderQueue();
    }
  }

  processRenderQueue(): void {
    if (this.renderQueue.length === 0) {
      this.isRendering = false;
      return;
    }

    this.renderQueue = [];
    this.renderAssStream();
    setTimeout(this.processRenderQueue, 0);
  }

  renderAssStream(): void {
    if (this.assistantStream.content.content) {
      this.clearDraftWorkingIcon();
    }

    this.assistantDraftReasoningEl = renderAssistantDraft(
      {
        contentEl: this.assistantDraftContentEl,
        reasoningEl: this.assistantDraftReasoningEl,
      },
      this.assistantStream.content,
      () => this.insertReasoningElem(this.assistantDraftContentEl),
      () => this.forceRemoveResponsingEl(),
    );
  }

  drawStreamAss(): void {
    this.assistantStream.reset(getUuid("msg"));
    this.assistantDraftContentEl = this.createAssTempElem(this.assistantStream.messageId);
    this.markDraftAssistantElement();
    this.assistantDraftReasoningEl = null;
    this.hasThinkingPlaceholder = true;
    this.scrollToBottom();
  }

  removeAllElem(): void {
    this.assistantDraftContentEl = null;
    this.assistantDraftReasoningEl = null;
    this.assistantStream.reset();
    this.hasThinkingPlaceholder = false;
    if (!this.container) return;

    const divs = this.container.getElementsByTagName("div");
    while (divs.length > 0) {
      divs[0].remove();
    }
  }

  addUserQHTMLElem(content: ChatPromptContent[], mid: string): void {
    this.createUserQHTMLElem(content, mid);
  }

  addAssHTMLElem(content: ChatPromptContent[], reasoning_content: string | null | undefined, mid: string, isError: boolean = false): void {
    const rendered = this.createAssHTMLElem(content, reasoning_content, mid, isError);
    if (!rendered) {
      console.warn("Failed to render assistant message:", mid);
      // dsAlert({ type: "warn", message: tr("toast.drawAssistantFailed") });
    }
  }

  addListener(): void {
    if (!this.container || this._isListenerActive) return;
    this.container.addEventListener("mouseover", this._mouseMoveLister);
    this.container.addEventListener("mouseout", this._mouseOutLister);
    this._isListenerActive = true;
  }

  removeListener(): void {
    if (!this.container || !this._isListenerActive) return;
    this.container.removeEventListener("mouseover", this._mouseMoveLister);
    this.container.removeEventListener("mouseout", this._mouseOutLister);
    this._isListenerActive = false;
  }

  _mouseMoveLister(event: MouseEvent): void {
    const targetClass = event.target.closest(".cmbu-user-content, .cmba-assistant-content");
    if (!targetClass) return;

    targetClass.querySelectorAll(".chat-md-bubble-options-button").forEach((div) => {
      div.classList.add("active");
    });
  }

  _mouseOutLister(): void {
    document.querySelectorAll(".chat-md-bubble-options-button.active").forEach((div) => {
      div.classList.remove("active");
    });
  }

  scrollToBottom = (): void => {
    if (!this.container) return;
    this.container.scrollTop = this.container.scrollHeight + 200;
  };
}

export default ChatDrawer;
