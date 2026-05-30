// @ts-nocheck
import { renderBlock } from "@/services/markdown/md-render";
import copyIcon from "@/assets/svg/copy16.svg";
import deleteIcon from "@/assets/svg/delete16.svg";
import { tr } from "@/i18n";
import { textToHtml } from "@/utils";
import { createSvgIcon } from "@/utils/svg-icon";
import type { ChatPromptContent } from "@/types";

function createWorkingIcon(): HTMLDivElement {
  const wrapper = document.createElement("div");
  wrapper.className = "cmba-working-icon";
  wrapper.innerHTML = `
    <svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
      <g>
        <line class="edge color-tl" x1="25%" y1="25%" x2="50%" y2="50%"></line>
        <line class="edge color-tr" x1="75%" y1="25%" x2="50%" y2="50%"></line>
        <line class="edge color-bl" x1="25%" y1="75%" x2="50%" y2="50%"></line>
        <line class="edge color-br" x1="75%" y1="75%" x2="50%" y2="50%"></line>
      </g>
      <circle class="center-node" cx="50%" cy="50%" r="10%"></circle>
      <g class="satellite-group">
        <circle class="color-tl" cx="25%" cy="25%" r="6%"></circle>
        <circle class="color-tr" cx="75%" cy="25%" r="5%"></circle>
        <circle class="color-bl" cx="25%" cy="75%" r="8%"></circle>
        <circle class="color-br" cx="75%" cy="75%" r="5.5%"></circle>
      </g>
    </svg>
  `;

  return wrapper;
}

export type ChatMessageElementActions = {
  onCopyAssistantMessage?: (mid: string) => void | Promise<void>;
  onDeleteMessage?: (mid: string) => void | Promise<void>;
  onPreviewImage?: (url: string) => void | Promise<void>;
};

/**
 * Creates chat message DOM nodes.
 *
 * The factory owns markup only. Store updates, persistence, clipboard, and image
 * preview behavior are supplied through callbacks by the caller.
 */
export class ChatMessageElementFactory {
  constructor(sync: boolean = false, actions: ChatMessageElementActions = {}) {
    this.id = "";
    this.container = null;
    this.sync = sync;
    this.actions = actions;

    this.createUserMessageElement = this.createUserMessageElement.bind(this);
    this.createAssistantMessageElement = this.createAssistantMessageElement.bind(this);
    this.createAssistantResponseElement = this.createAssistantResponseElement.bind(this);
    this.createAssistantDraftElement = this.createAssistantDraftElement.bind(this);
    this.findMessageIndex = this.findMessageIndex.bind(this);
  }

  setMessageActions(actions: ChatMessageElementActions = {}): void {
    this.actions = {
      ...this.actions,
      ...actions,
    };
  }

  createUserMessageElement(content: ChatPromptContent[], mid: string): HTMLDivElement | null {
    if (!this.container) return null;

    const userDiv = document.createElement("div");
    userDiv.classList.add("chat-md-bubble-user");
    userDiv.id = mid;

    const userContentDiv = document.createElement("div");
    userContentDiv.classList.add("cmbu-user-content");

    const contentAreaDiv = document.createElement("div");
    contentAreaDiv.classList.add("cmbu-content-area");

    const imageAreaEl = document.createElement("div");
    imageAreaEl.classList.add("cmbu-img-area");

    const textDiv = document.createElement("div");
    textDiv.classList.add("cmbu-content-text");

    for (const prompt of content) {
      if (prompt.type === "text") {
        textDiv.innerHTML = textToHtml(prompt.text);
      }

      if (prompt.type === "image_url") {
        const imageEl = document.createElement("img");
        imageEl.classList.add("cmbu-item");
        imageEl.src = prompt.image_url.url;
        imageEl.onclick = () => this.actions.onPreviewImage?.(imageEl.src);
        imageAreaEl.appendChild(imageEl);
      }
    }

    if (content.some((item) => item.type === "image_url")) {
      contentAreaDiv.appendChild(imageAreaEl);
    }

    contentAreaDiv.appendChild(textDiv);
    userContentDiv.appendChild(contentAreaDiv);
    userContentDiv.appendChild(this.createMessageOptions(mid, ["delete"]));
    userDiv.appendChild(userContentDiv);
    this.container.appendChild(userDiv);

    return userDiv;
  }

  createUserQHTMLElem(content: ChatPromptContent[], mid: string): HTMLDivElement | null {
    return this.createUserMessageElement(content, mid);
  }

  createAssistantMessageElement(
    content: ChatPromptContent[],
    reasoningContent: string | null | undefined,
    mid: string,
    isError: boolean = false,
  ): HTMLDivElement | null {
    if (!this.container) return null;

    const assistantDiv = document.createElement("div");
    assistantDiv.id = mid;
    assistantDiv.classList.add("chat-md-bubble-assistant");
    if (isError) assistantDiv.classList.add("is-error");
    this.container.appendChild(assistantDiv);

    const textDiv = this.createAssistantResponseElement(assistantDiv, mid, false);

    if (reasoningContent) {
      const reasoningTextDiv = this.insertReasoningElem(textDiv);
      renderBlock("markdown-content", reasoningTextDiv, reasoningContent);
    }

    const text = content[0]?.type === "text" ? content[0].text : "";
    renderBlock("markdown-content", textDiv, text);

    return assistantDiv;
  }

  createAssHTMLElem(content: ChatPromptContent[], reasoningContent: string | null | undefined, mid: string, isError: boolean = false): HTMLDivElement | null {
    return this.createAssistantMessageElement(content, reasoningContent, mid, isError);
  }

  createAssistantResponseElement(assistantDiv: HTMLDivElement, mid: string, working: boolean = false): HTMLDivElement {
    const contentDiv = document.createElement("div");
    contentDiv.classList.add("cmba-assistant-content");

    const iconDiv = document.createElement("div");
    iconDiv.classList.add("cmba-assistant-icon");
    if (working) {
      iconDiv.appendChild(createWorkingIcon());
    }

    const textDiv = document.createElement("div");
    textDiv.classList.add("markdown-content");

    contentDiv.appendChild(textDiv);
    if (!working) contentDiv.appendChild(this.createMessageOptions(mid, ["copy", "delete"]));
    assistantDiv.appendChild(iconDiv);
    assistantDiv.appendChild(contentDiv);
    return textDiv;
  }

  createAssResponseElem(assistantDiv: HTMLDivElement, mid: string, thinking: boolean = false): HTMLDivElement {
    return this.createAssistantResponseElement(assistantDiv, mid, thinking);
  }

  createMessageOptions(mid: string, actions: ("copy" | "delete")[]): HTMLDivElement {
    const optionsDiv = document.createElement("div");
    optionsDiv.classList.add(actions.includes("copy") ? "cmba-options" : "cmbu-options");

    if (actions.includes("copy")) {
      const copyButton = this.createIconButton(copyIcon, tr("tooltip.copyText"));
      copyButton.addEventListener("click", () => this.actions.onCopyAssistantMessage?.(mid));
      optionsDiv.appendChild(copyButton);
    }

    if (actions.includes("delete")) {
      const deleteButton = this.createIconButton(deleteIcon, tr("tooltip.deleteMessage"));
      deleteButton.addEventListener("click", () => this.actions.onDeleteMessage?.(mid));
      optionsDiv.appendChild(deleteButton);
    }

    return optionsDiv;
  }

  createIconButton(icon: string, tip: string): HTMLDivElement {
    const button = document.createElement("div");
    button.classList.add("chat-md-bubble-options-button", "tooltip", "tooltip-top");
    button.dataset.tip = tip;
    button.appendChild(createSvgIcon(icon, { size: "16px" }));
    return button;
  }

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

  createAssistantDraftElement(mid: string): HTMLDivElement | null {
    if (!this.container) return null;

    const assistantDiv = document.createElement("div");
    assistantDiv.id = mid;
    assistantDiv.classList.add("chat-md-bubble-assistant");
    this.container.appendChild(assistantDiv);

    return this.createAssistantResponseElement(assistantDiv, mid, true);
  }

  createAssTempElem(mid: string): HTMLDivElement | null {
    return this.createAssistantDraftElement(mid);
  }

  findMessageIndex(id: string): number {
    if (!this.container) return -1;
    return Array.from(this.container.children).findIndex((child) => child.id === id);
  }

  findMsgIndex(id: string): number {
    return this.findMessageIndex(id);
  }
}

export { ChatMessageElementFactory as ChatElemCreator };
