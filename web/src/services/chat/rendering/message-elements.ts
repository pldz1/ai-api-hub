// @ts-nocheck
import store from "@/store";

import { dsAlert, textToHtml } from "@/utils";
import { tr } from "@/i18n";
import { renderBlock } from "../../markdown/md-render";
import appIcon from "@/assets/svg/app18.svg";
import copyIcon from "@/assets/svg/copy16.svg";
import deleteIcon from "@/assets/svg/delete16.svg";
import { createSvgIcon } from "@/utils/svg-icon";
import { deleteMessage } from "../conversation";
import type { ChatPromptContent } from "@/services/types";

/**
 * Chat message element factory.
 *
 * Builds DOM nodes for persisted and streaming chat messages, including text,
 * reasoning blocks, image attachments, and per-message action buttons.
 */
export class ChatElemCreator {
  constructor(sync: boolean = false) {
    this.id = "";
    this.container = null;
    this.sync = sync;

    this.createUserQHTMLElem = this.createUserQHTMLElem.bind(this);
    this.createAssHTMLElem = this.createAssHTMLElem.bind(this);
    this.createAssResponseElem = this.createAssResponseElem.bind(this);
    this.createAssTempElem = this.createAssTempElem.bind(this);
    this.findMsgIndex = this.findMsgIndex.bind(this);
    this.deleteMessage = this.deleteMessage.bind(this);
  }

  /**
   * Create a user message element.
   */
  createUserQHTMLElem(content: ChatPromptContent[], mid: string): HTMLDivElement | null {
    if (!this.container) return null;
    const userDiv = document.createElement("div");
    userDiv.classList.add("chat-md-bubble-user");
    userDiv.id = mid;

    const userContentDiv = document.createElement("div");
    userContentDiv.classList.add("cmbu-user-content");

    const contentAreaDiv = document.createElement("div");
    contentAreaDiv.classList.add("cmbu-content-area");

    const imgAreaElem = document.createElement("div");
    imgAreaElem.classList.add("cmbu-img-area");
    const textDiv = document.createElement("div");
    textDiv.classList.add("cmbu-content-text");

    content.forEach((prompt) => {
      if (prompt.type == "text") {
        textDiv.innerHTML = textToHtml(prompt.text);
      }

      if (prompt.type == "image_url") {
        const imgItem = document.createElement("img");
        imgItem.classList.add("cmbu-item");
        imgItem.src = prompt.image_url.url;
        // Open the clicked image in the preview modal.
        imgItem.onclick = async () => {
          await store.dispatch("setModalImage", imgItem.src);
          // global_image_preview_modal is the modal element ID.
          global_image_preview_modal.showModal();
        };
        imgAreaElem.appendChild(imgItem);
      }
    });

    const hasImgContent = content.some((obj) => obj.type === "image_url");
    if (hasImgContent) {
      contentAreaDiv.appendChild(imgAreaElem);
    }

    contentAreaDiv.appendChild(textDiv);
    userContentDiv.appendChild(contentAreaDiv);

    const optionsDiv = document.createElement("div");
    optionsDiv.classList.add("cmbu-options");

    const deleteButtonDiv = document.createElement("div");
    deleteButtonDiv.classList.add("chat-md-bubble-options-button", "tooltip", "tooltip-top");
    deleteButtonDiv.dataset.tip = tr("tooltip.deleteMessage");
    deleteButtonDiv.appendChild(createSvgIcon(deleteIcon, { size: "16px" }));
    optionsDiv.appendChild(deleteButtonDiv);

    deleteButtonDiv.addEventListener("click", async () => {
      this.deleteMessage(mid);
      userDiv.remove();
      deleteMessage(mid);
    });

    userContentDiv.appendChild(optionsDiv);
    userDiv.appendChild(userContentDiv);
    this.container.appendChild(userDiv);

    return userDiv;
  }

  /**
   * Create an assistant message element.
   */
  createAssHTMLElem(content: ChatPromptContent[], reasoning_content: string | null | undefined, mid: string): HTMLDivElement | null {
    if (!this.container) return null;

    const assistantDiv = document.createElement("div");
    assistantDiv.id = mid;
    assistantDiv.classList.add("chat-md-bubble-assistant");

    this.container.appendChild(assistantDiv);

    const textDiv = this.createAssResponseElem(assistantDiv, mid, false);

    if (reasoning_content) {
      const reasoningTextDiv = this.insertReasoningElem(textDiv);
      renderBlock("markdown-content", reasoningTextDiv, reasoning_content);
    }

    const text = content[0]?.type === "text" ? content[0].text : "";
    renderBlock("markdown-content", textDiv, text);

    return assistantDiv;
  }

  /**
   * Create an assistant response element.
   */
  createAssResponseElem(assistantDiv: HTMLDivElement, mid: string, thinking: boolean = false): HTMLDivElement {
    const assistantIconDiv = document.createElement("div");
    assistantIconDiv.classList.add("cmba-assistant-icon");
    assistantIconDiv.appendChild(createSvgIcon(appIcon, { colored: true, size: "18px" }));

    const assistantContentDiv = document.createElement("div");
    assistantContentDiv.classList.add("cmba-assistant-content");

    const textDiv = document.createElement("div");
    textDiv.classList.add("markdown-content");

    if (thinking) {
      textDiv.innerHTML = `<div class="markdown-p-text"> ${tr("common.saving")}... </div>`;
    }

    const optionsDiv = document.createElement("div");
    optionsDiv.classList.add("cmba-options");

    const copyMarkdownButtonDiv = document.createElement("div");
    copyMarkdownButtonDiv.classList.add("chat-md-bubble-options-button", "tooltip", "tooltip-top");
    copyMarkdownButtonDiv.dataset.tip = tr("tooltip.copyText");
    copyMarkdownButtonDiv.appendChild(createSvgIcon(copyIcon, { size: "16px" }));
    optionsDiv.appendChild(copyMarkdownButtonDiv);
    copyMarkdownButtonDiv.addEventListener("click", async () => {
      const index = this.findMsgIndex(mid);
      if (index < 0) {
        dsAlert({ type: "error", message: tr("toast.invalidMessage") });
        return;
      }

      const message = store.state.messages[index];

      navigator.clipboard
        .writeText(message.content[0].text)
        .then(() => {
          dsAlert({ type: "success", message: tr("toast.messageCopySuccess") });
        })
        .catch((err) => {
          dsAlert({ type: "error", message: tr("toast.messageCopyFailed", { error: String(err) }) });
        });
    });

    const deleteButtonDiv = document.createElement("div");
    deleteButtonDiv.classList.add("chat-md-bubble-options-button", "tooltip", "tooltip-top");
    deleteButtonDiv.dataset.tip = tr("tooltip.deleteMessage");
    deleteButtonDiv.appendChild(createSvgIcon(deleteIcon, { size: "16px" }));
    optionsDiv.appendChild(deleteButtonDiv);
    deleteButtonDiv.addEventListener("click", async () => {
      this.deleteMessage(mid);
      assistantDiv.remove();
      deleteMessage(mid);
    });

    assistantContentDiv.appendChild(textDiv);
    assistantContentDiv.appendChild(optionsDiv);
    assistantDiv.appendChild(assistantIconDiv);
    assistantDiv.appendChild(assistantContentDiv);

    return textDiv;
  }

  /**
   * Insert a reasoning block before the assistant response.
   */

  insertReasoningElem(el: HTMLElement): HTMLDivElement | null {
    const reasoningEl = document.createElement("div");
    const parent = el.parentNode;

    if (!parent) return null;
    parent.insertBefore(reasoningEl, el);
    reasoningEl.className = "cmba-reasoning-content";

    const detailsEl = document.createElement("details");
    detailsEl.open = true;
    reasoningEl.appendChild(detailsEl);

    const summaryEl = document.createElement("summary");
    summaryEl.innerHTML = tr("tooltip.reasoning");
    detailsEl.appendChild(summaryEl);

    const reasoningTextDiv = document.createElement("div");
    reasoningTextDiv.className = "markdown-content";
    detailsEl.appendChild(reasoningTextDiv);

    return reasoningTextDiv;
  }

  /**
   * Create a temporary assistant message element.
   */
  createAssTempElem(mid: string): HTMLDivElement | null {
    if (!this.container) return null;

    const assistantDiv = document.createElement("div");
    assistantDiv.id = mid;
    assistantDiv.classList.add("chat-md-bubble-assistant");

    this.container.appendChild(assistantDiv);

    const textDiv = this.createAssResponseElem(assistantDiv, mid, true);

    return textDiv;
  }

  /**
   * Find a message index among the container's direct children.
   */
  findMsgIndex(id: string): number {
    if (!this.container) return -1;
    const childrenArray = Array.from(this.container.children);
    return childrenArray.findIndex((child) => child.id === id);
  }

  /**
   * Delete a message from the store.
   */

  async deleteMessage(mid: string): Promise<void> {
    const index = this.findMsgIndex(mid);

    if (index < 0) dsAlert({ type: "error", message: tr("toast.invalidMessage") });
    else await store.dispatch("spliceMessages", index);
  }
}
