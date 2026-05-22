// @ts-nocheck
import store from "@/store/index";

import { dsAlert, getUuid } from "@/utils";
import { tr } from "@/i18n";
import { renderBlock } from "../../markdown/md-render";
import { ChatProxy } from "../chat-proxy";
import { ChatElemCreator } from "./message-elements";
import { addMessage } from "../conversation";
import type { ChatPromptContent, ChatPromptMessage, ChatProviderResponse, TokenUsage } from "@/services/types";

/**
 * Chat drawer.
 *
 * Coordinates the chat UI DOM, streaming render queue, message persistence,
 * and the provider call through `ChatProxy`.
 */

/**
 * Chat prompt content item.
 */

/**
 * Chat prompt message.
 */

export class ChatDrawer extends ChatElemCreator {
  constructor(sync: boolean = false) {
    super(sync);

    this._isListenerActive = false;

    this.client = new ChatProxy();

    this.tmpAssIsResponsingElFlag = true;
    this.tmpAssContentDiv = null;
    this.tmpAssReasoningDiv = null;
    this.tmpAssContentMid = "";
    this.tmpAssErrorFlag = false;
    this.tmpAssContentData = { content: "", reasoning_content: "" };
    this.tmpAssTokenUsage = null;
    this.renderQueue = [];
    this.isRendering = false;
    this.forceStop = false;

    this.enqueueRender = this.enqueueRender.bind(this);
    this.processRenderQueue = this.processRenderQueue.bind(this);
    this.renderAssStream = this.renderAssStream.bind(this);
    this.draw = this.draw.bind(this);
  }

  init(id: string): void {
    this.id = id;
    this.container = document.getElementById(this.id);
    this.addListener();
  }

  chatClientInit(): void {
    this.client.init({});
  }

  /**
   * Send a chat message.
   */
  async chat(data: ChatPromptMessage): Promise<void> {
    this.removeListener();
    this.client.init({});
    this.forceStop = false;
    this.tmpAssErrorFlag = false;
    this.tmpAssContentData = { content: "", reasoning_content: "" };
    this.tmpAssTokenUsage = null;

    const chatData = { ...data, mid: getUuid("msg") };
    this.draw([chatData]);
    this.drawStreamAss();

    await store.dispatch("pushMessages", data);
    if (this.sync) await addMessage(store.state.curChatId, chatData.mid, data);

    const passedMsgLen = store.state.curChatModelSettings.passedMsgLen;
    const history = store.state.messages;
    const messages = history.slice(-Math.min(passedMsgLen, history.length));

    await store.dispatch("setLlmRequestPending", true);
    const flag = await this.client.chat(messages, {}, this.enqueueRender);

    if (this.forceStop) {
      await store.dispatch("setLlmRequestPending", false);
      return;
    }

    const hasAssistantContent = Boolean(this.tmpAssContentData.content || this.tmpAssContentData.reasoning_content);

    if (this.tmpAssErrorFlag) {
      if (hasAssistantContent) {
        const assistantData = {
          role: "assistant",
          content: [{ type: "text", text: this.tmpAssContentData.content }],
          reasoning_content: this.tmpAssContentData.reasoning_content,
        };
        if (this.tmpAssTokenUsage) assistantData.token_usage = this.tmpAssTokenUsage;

        await store.dispatch("pushMessages", assistantData);
        if (this.sync) await addMessage(store.state.curChatId, this.tmpAssContentMid, assistantData);
      } else {
        this.removeTempAssistantElem();
      }

      this.addListener();
      await store.dispatch("setLlmRequestPending", false);
      return;
    }

    if (!flag) {
      this.removeTempAssistantElem();
      this.addListener();
      await store.dispatch("setLlmRequestPending", false);
      return;
    }

    // Update conversation history after the provider finishes.
    if (flag) {
      if (this.tmpAssContentData.content == "") {
        // Remove the temporary response when the provider returns no content.
        this.forceRemoveResponsingEl();
        this.draw([
          {
            role: "assistant",
            content: [{ type: "text", text: tr("chat.timeoutNoContent") }],
          },
        ]);
      } else {
        const assistantData = {
          role: "assistant",
          content: [{ type: "text", text: this.tmpAssContentData.content }],
          reasoning_content: this.tmpAssContentData.reasoning_content,
        };
        if (this.tmpAssTokenUsage) assistantData.token_usage = this.tmpAssTokenUsage;

        await store.dispatch("pushMessages", assistantData);
        if (this.sync) await addMessage(store.state.curChatId, this.tmpAssContentMid, assistantData);
      }
    }

    this.addListener();
    await store.dispatch("setLlmRequestPending", false);
  }

  /**
   * Stop the current chat request and rendering.
   */
  stop(): void {
    this.forceStop = true;
    this.client.abort();
    this.tmpAssContentDiv = null;
    this.renderQueue = [];
    this.isRendering = false;
    store.dispatch("setLlmRequestPending", false);
    this.addListener();
  }

  /**
   * Remove the temporary assistant response element.
   */

  forceRemoveResponsingEl(): void {
    if (this.tmpAssIsResponsingElFlag) {
      const assEl = this.container.querySelector(".markdown-p-text");
      if (assEl) assEl.remove();
      this.tmpAssIsResponsingElFlag = false;
    }
  }

  removeTempAssistantElem(): void {
    const assistantEl = this.tmpAssContentDiv?.closest(".chat-md-bubble-assistant");
    if (assistantEl) assistantEl.remove();
    this.tmpAssContentDiv = null;
    this.tmpAssReasoningDiv = null;
    this.tmpAssIsResponsingElFlag = false;
  }

  /**
   * Draw chat message bubbles.
   */
  draw(messages: ChatPromptMessage[]): void {
    for (let index = 0; index < messages.length; index++) {
      const msg = messages[index];
      if (!msg.mid) msg.mid = getUuid("msg");

      if (msg.role == "user") {
        this.addUserQHTMLElem(msg.content, msg.mid);
      }

      if (msg.role == "assistant") {
        this.addAssHTMLElem(msg.content, msg?.reasoning_content, msg.mid);
      }
    }
  }

  renderConversation(messages: ChatPromptMessage[] = []): void {
    this.removeAllElem();
    this.draw(messages);
  }

  syncDraftAssistant(runtime: Record<string, unknown> = {}): void {
    const content = String(runtime?.draftAssistantContent || "");
    const reasoning_content = String(runtime?.draftReasoningContent || "");
    const draftMessageId = String(runtime?.draftMessageId || "");
    const hasDraft = Boolean(draftMessageId || content || reasoning_content || runtime?.pending);

    if (!hasDraft) {
      this.removeTempAssistantElem();
      return;
    }

    if (!this.tmpAssContentDiv || this.tmpAssContentMid !== draftMessageId) {
      this.removeTempAssistantElem();
      this.tmpAssContentMid = draftMessageId;
      this.tmpAssContentDiv = this.createAssTempElem(this.tmpAssContentMid);
      this.tmpAssReasoningDiv = null;
      this.tmpAssIsResponsingElFlag = true;
    }

    this.tmpAssContentData = { content, reasoning_content };
    this.renderAssStream();
  }

  /**
   * Queue provider output for rendering.
   */
  enqueueRender(response: ChatProviderResponse): void {
    if (this.forceStop) return;

    store.dispatch("setLlmRequestPending", false);

    if (response?.usage) {
      this.tmpAssTokenUsage = response.usage;
    }

    if (!response.flag) {
      // Keep already rendered stream content intact and surface the error separately.
      this.renderQueue = [];
      this.isRendering = false;
      this.tmpAssErrorFlag = true;

      if (this.tmpAssContentDiv && (this.tmpAssContentData.content || this.tmpAssContentData.reasoning_content)) this.renderAssStream();
      else this.forceRemoveResponsingEl();

      dsAlert({ type: "error", message: response.content, duration: 10000 });
      return;
    }

    this.tmpAssContentData.content += response?.content || "";
    this.tmpAssContentData.reasoning_content += response?.reasoning_content || "";

    // The latest text is stored on tmpAssContentData, so the queue item can be empty.
    this.renderQueue.push("");
    // Start the queue when no render task is running.
    if (!this.isRendering) {
      this.isRendering = true;
      this.processRenderQueue();
    }
  }

  /**
   * Process the streaming render queue.
   *
   * Only the latest queued state is rendered.
   */
  processRenderQueue(): void {
    if (this.renderQueue.length === 0) {
      this.isRendering = false;
      return;
    }

    // Clear stale queued states before rendering the latest content.
    this.renderQueue = [];
    this.renderAssStream();
    setTimeout(this.processRenderQueue, 0);
  }

  /**
   * Render the assistant stream into the current message element.
   */
  renderAssStream(): void {
    // Skip rendering if the response container is missing.
    if (!this.tmpAssContentDiv) return;

    const { reasoning_content, content } = this.tmpAssContentData;

    // Add and render a reasoning block when reasoning content is present.
    if (reasoning_content) {
      this.tmpAssReasoningDiv = this.tmpAssReasoningDiv || this.insertReasoningElem(this.tmpAssContentDiv);
      if (this.tmpAssReasoningDiv) {
        this.forceRemoveResponsingEl();
        renderBlock("markdown-content", this.tmpAssReasoningDiv, reasoning_content);
      }
    }

    // Render visible assistant text.
    if (content) {
      renderBlock("markdown-content", this.tmpAssContentDiv, content);
    }
  }

  /**
   * Start drawing a streaming assistant response.
   */
  drawStreamAss(): void {
    this.forceStop = false;
    this.tmpAssContentMid = getUuid("msg");
    this.tmpAssContentDiv = this.createAssTempElem(this.tmpAssContentMid);
    this.tmpAssIsResponsingElFlag = true;
    this.tmpAssReasoningDiv = null;
    this.tmpAssErrorFlag = false;
    this.tmpAssContentData = { content: "", reasoning_content: "" };
    this.scrollToBottom();
  }

  /**
   * Remove all div elements from the container.
   */
  removeAllElem(): void {
    this.tmpAssContentDiv = null;
    this.tmpAssReasoningDiv = null;
    this.tmpAssContentMid = "";
    this.tmpAssIsResponsingElFlag = false;
    if (!this.container) return;
    const divs = this.container.getElementsByTagName("div");
    while (divs.length > 0) {
      divs[0].remove();
    }
  }

  /**
   * Add a user message element.
   */
  addUserQHTMLElem(content: ChatPromptContent[], mid: string): void {
    const res = this.createUserQHTMLElem(content, mid);
    if (!res) {
      // dsAlert({ type: "warn", message: tr("toast.drawUserQuestionFailed") });
    }
  }

  /**
   * Add an assistant message element.
   */
  addAssHTMLElem(content: ChatPromptContent[], reasoning_content: string | null | undefined, mid: string): void {
    const res = this.createAssHTMLElem(content, reasoning_content, mid);
    if (!res) {
      dsAlert({ type: "warn", message: tr("toast.drawAssistantFailed") });
    }
  }

  /**
   * Add hover listeners for chat message actions.
   */
  addListener(): void {
    if (!this.container) return;
    if (this._isListenerActive) return;
    this.container.addEventListener("mouseover", this._mouseMoveLister);
    this.container.addEventListener("mouseout", this._mouseOutLister);
    this._isListenerActive = true;
  }

  /**
   * Remove hover listeners for chat message actions.
   */
  removeListener(): void {
    if (!this.container) return;
    if (!this._isListenerActive) return;
    this.container.removeEventListener("mouseover", this._mouseMoveLister);
    this.container.removeEventListener("mouseout", this._mouseOutLister);
    this._isListenerActive = false;
  }

  /**
   * Show message actions while hovering over a chat bubble.
   */
  _mouseMoveLister(event: MouseEvent): void {
    const targetClass = event.target.closest(".cmbu-user-content, .cmba-assistant-content");
    if (targetClass) {
      const optionButtons = targetClass.querySelectorAll(".chat-md-bubble-options-button");
      optionButtons.forEach((div) => {
        div.classList.add("active");
      });
    }
  }

  /**
   * Hide message actions when the pointer leaves a chat bubble.
   */
  _mouseOutLister(): void {
    const activeOptionButtons = document.querySelectorAll(".chat-md-bubble-options-button.active");
    activeOptionButtons.forEach((div) => {
      div.classList.remove("active");
    });
  }

  /**
   * Scroll the container to the bottom.
   */
  scrollToBottom = (): void => {
    if (!this.container) return;
    this.container.scrollTop = this.container.scrollHeight + 200;
  };
}

export default ChatDrawer;
