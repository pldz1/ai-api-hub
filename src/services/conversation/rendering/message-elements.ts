import { renderBlock } from "@/services/markdown/md-render";
import arrowUpIcon from "@/assets/svg/arrowUp32.svg";
import copyIcon from "@/assets/svg/copy16.svg";
import deleteIcon from "@/assets/svg/delete16.svg";
import saveIcon from "@/assets/svg/save18.svg";
import { tr } from "@/i18n";
import { textToHtml } from "@/utils";
import { createSvgIcon } from "@/utils/svg-icon";
import type { ChatPromptContent, ChatPromptMessage, ChatMessageAttachment } from "@/types";

const USER_CONTENT_COLLAPSED_HEIGHT = 200;

export interface MessageElementActions {
  onCopyAssistantMessage?: (mid: string) => void | Promise<void>;
  onDeleteMessage?: (mid: string) => void | Promise<void>;
  onPreviewImage?: (url: string) => void | Promise<void>;
  onPreviewAttachment?: (attachment: ChatMessageAttachment) => void | Promise<void>;
  onDownloadAttachment?: (attachment: ChatMessageAttachment) => void | Promise<void>;
}

// -- helpers --

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

function createIconButton(icon: string, tip: string): HTMLDivElement {
  const button = document.createElement("div");
  button.classList.add("chat-md-bubble-options-button", "tooltip", "tooltip-top");
  button.dataset.tip = tip;
  button.appendChild(createSvgIcon(icon, { size: "16px" }));
  return button;
}

function createAttachmentActionButton(icon: string, tip: string, onClick: () => void | Promise<void>): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "cmbu-file-action tooltip tooltip-top";
  button.dataset.tip = tip;
  button.setAttribute("aria-label", tip);
  button.appendChild(createSvgIcon(icon, { size: "18px" }));
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    void onClick();
  });
  return button;
}

function createMessageOptions(mid: string, which: ("copy" | "delete")[], actions: MessageElementActions): HTMLDivElement {
  const optionsDiv = document.createElement("div");
  optionsDiv.classList.add(which.includes("copy") ? "cmba-options" : "cmbu-options");

  if (which.includes("copy")) {
    const copyBtn = createIconButton(copyIcon, tr("tooltip.copyText"));
    copyBtn.addEventListener("click", () => actions.onCopyAssistantMessage?.(mid));
    optionsDiv.appendChild(copyBtn);
  }

  if (which.includes("delete")) {
    const deleteBtn = createIconButton(deleteIcon, tr("tooltip.deleteMessage"));
    deleteBtn.addEventListener("click", () => actions.onDeleteMessage?.(mid));
    optionsDiv.appendChild(deleteBtn);
  }

  return optionsDiv;
}

function createFileAttachmentElement(attachment: ChatMessageAttachment, actions: MessageElementActions): HTMLDivElement {
  const item = document.createElement("div");
  item.className = "cmbu-file-item";

  const badge = document.createElement("div");
  badge.className = "cmbu-file-kind";
  badge.textContent = String(attachment.kindLabel || "FILE").toUpperCase();

  const body = actions.onPreviewAttachment ? document.createElement("button") : document.createElement("div");
  body.className = "cmbu-file-card";
  if (body instanceof HTMLButtonElement) {
    body.type = "button";
    body.setAttribute("aria-label", tr("tooltip.previewAttachment"));
    body.addEventListener("click", () => {
      void actions.onPreviewAttachment?.(attachment);
    });
  }

  const name = document.createElement("div");
  name.className = "cmbu-file-label";
  name.textContent = attachment.name;
  body.appendChild(name);

  item.appendChild(badge);
  item.appendChild(body);
  if (actions.onDownloadAttachment) {
    item.appendChild(createAttachmentActionButton(saveIcon, tr("tooltip.downloadAttachment"), () => actions.onDownloadAttachment?.(attachment)));
  }
  return item;
}

function createFileAttachmentArea(attachments: ChatMessageAttachment[], actions: MessageElementActions): HTMLDivElement {
  const area = document.createElement("div");
  area.className = "cmbu-file-area";
  attachments.forEach((attachment) => area.appendChild(createFileAttachmentElement(attachment, actions)));
  return area;
}

function setupUserContentCollapse(contentAreaDiv: HTMLDivElement, contentBodyDiv: HTMLDivElement) {
  requestAnimationFrame(() => {
    if (contentBodyDiv.scrollHeight <= USER_CONTENT_COLLAPSED_HEIGHT) return;

    let expanded = false;
    const toggleBtn = document.createElement("button");
    toggleBtn.className = "cmbu-content-toggle";
    toggleBtn.type = "button";

    const update = () => {
      contentAreaDiv.classList.toggle("is-expanded", expanded);
      toggleBtn.classList.toggle("is-expanded", expanded);
      toggleBtn.setAttribute("aria-label", expanded ? tr("common.collapseMessage") : tr("common.expandMessage"));
      toggleBtn.setAttribute("aria-expanded", String(expanded));
      toggleBtn.replaceChildren(createSvgIcon(arrowUpIcon, { className: "cmbu-content-toggle-icon", size: "16px" }));
    };

    const toggle = () => {
      expanded = !expanded;
      if (!expanded) contentBodyDiv.scrollTop = 0;
      update();
    };

    toggleBtn.addEventListener("click", toggle);
    contentAreaDiv.classList.add("is-collapsible");
    update();
    contentAreaDiv.appendChild(toggleBtn);
  });
}

// -- public element factories --

export function createUserMessageElement(container: HTMLElement, message: ChatPromptMessage, actions: MessageElementActions): HTMLDivElement | null {
  const userDiv = document.createElement("div");
  userDiv.classList.add("chat-md-bubble-user");
  userDiv.id = message.mid || "";

  const userContentDiv = document.createElement("div");
  userContentDiv.classList.add("cmbu-user-content");

  const contentAreaDiv = document.createElement("div");
  contentAreaDiv.classList.add("cmbu-content-area");

  const contentBodyDiv = document.createElement("div");
  contentBodyDiv.classList.add("cmbu-content-body");

  const imageAreaEl = document.createElement("div");
  imageAreaEl.classList.add("cmbu-img-area");

  const textDiv = document.createElement("div");
  textDiv.classList.add("cmbu-content-text");

  const content = message.content || [];
  for (const prompt of content) {
    if (prompt.type === "text") {
      textDiv.innerHTML = textToHtml(prompt.text);
    }

    if (prompt.type === "image_url") {
      const imageEl = document.createElement("img");
      imageEl.classList.add("cmbu-item");
      imageEl.src = prompt.image_url.url;
      imageEl.onclick = () => actions.onPreviewImage?.(imageEl.src);
      imageAreaEl.appendChild(imageEl);
    }
  }

  if (message.attachments?.length) {
    contentBodyDiv.appendChild(createFileAttachmentArea(message.attachments, actions));
  }

  if (content.some((item) => item.type === "image_url")) {
    contentBodyDiv.appendChild(imageAreaEl);
  }

  if (content.some((item) => item.type === "text")) {
    contentBodyDiv.appendChild(textDiv);
  }
  contentAreaDiv.appendChild(contentBodyDiv);
  userContentDiv.appendChild(contentAreaDiv);
  setupUserContentCollapse(contentAreaDiv, contentBodyDiv);
  userContentDiv.appendChild(createMessageOptions(message.mid || "", ["delete"], actions));
  userDiv.appendChild(userContentDiv);
  container.appendChild(userDiv);

  return userDiv;
}

export function createAssistantMessageElement(
  container: HTMLElement,
  message: ChatPromptMessage,
  actions: MessageElementActions,
): HTMLDivElement | null {
  const assistantDiv = document.createElement("div");
  assistantDiv.id = message.mid || "";
  assistantDiv.classList.add("chat-md-bubble-assistant");
  if (message.meta?.isContextBlocked) assistantDiv.classList.add("is-error");
  container.appendChild(assistantDiv);

  const textDiv = createAssistantResponseElement(assistantDiv, message.mid || "", false, actions);

  if (message.reasoning_content) {
    const reasoningTextDiv = insertReasoningElem(textDiv);
    renderBlock("markdown-content", reasoningTextDiv, message.reasoning_content);
  }

  const text = message.content[0]?.type === "text" ? message.content[0].text : "";
  renderBlock("markdown-content", textDiv, text);
  if (message.meta?.run?.result) insertRunInfo(textDiv, message);

  return assistantDiv;
}

function formatRunDuration(durationMs: number): string {
  if (durationMs < 1000) return `${Math.round(durationMs)}ms`;
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function createRunFact(label: string, value: string, technical = false): HTMLDivElement {
  const fact = document.createElement("div");
  if (technical) fact.classList.add("is-technical");
  const keyEl = document.createElement("dt");
  const valueEl = document.createElement("dd");
  keyEl.textContent = label;
  valueEl.textContent = value || "—";
  fact.append(keyEl, valueEl);
  return fact;
}

function insertRunInfo(textDiv: HTMLDivElement, message: ChatPromptMessage): void {
  const run = message.meta?.run;
  const contentDiv = textDiv.parentElement;
  if (!run?.result || !contentDiv) return;

  const details = document.createElement("details");
  details.className = "cmba-run-info";
  details.dataset.status = run.status;

  const summary = document.createElement("summary");
  const totalTokens = Number(run.result.usage.total_tokens || 0);
  const label = document.createElement("span");
  label.className = "cmba-run-label";
  label.textContent = tr("chat.runBubble.label");
  const model = document.createElement("span");
  model.className = "cmba-run-model";
  model.textContent = run.route.model;
  const metrics = document.createElement("span");
  metrics.className = "cmba-run-metrics";
  metrics.textContent = [run.status, formatRunDuration(run.durationMs), totalTokens > 0 ? `${totalTokens.toLocaleString()} tokens` : ""]
    .filter(Boolean)
    .join(" · ");
  summary.append(label, model, metrics);

  const body = document.createElement("div");
  body.className = "cmba-run-body";

  const facts = document.createElement("dl");
  facts.className = "cmba-run-facts";
  facts.append(
    createRunFact(tr("chat.runBubble.fields.provider"), run.route.provider),
    createRunFact(tr("chat.runBubble.fields.adapter"), run.route.adapterId, true),
    createRunFact(tr("chat.runBubble.fields.binding"), run.route.bindingKey, true),
    createRunFact(tr("chat.runBubble.fields.connectionUrl"), run.route.connectionURL, true),
    createRunFact(tr("chat.runBubble.fields.messageCount"), String(run.request.inputCount)),
  );
  body.appendChild(facts);

  const capabilities = Object.entries(run.request.capabilities)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([key]) => key)
    .join(", ");
  facts.appendChild(createRunFact(tr("chat.runBubble.fields.capabilities"), capabilities || tr("chat.runBubble.none")));

  const paramsDetails = document.createElement("details");
  paramsDetails.className = "cmba-run-params";
  const paramsSummary = document.createElement("summary");
  paramsSummary.textContent = tr("chat.runBubble.fields.parameters");
  const params = document.createElement("pre");
  params.textContent = JSON.stringify(run.request.params, null, 2);
  paramsDetails.append(paramsSummary, params);
  body.appendChild(paramsDetails);

  if (run.error) {
    const error = document.createElement("div");
    error.className = "cmba-run-error";
    error.textContent = `${tr("chat.runBubble.fields.error")}: ${run.error}`;
    body.appendChild(error);
  }

  details.append(summary, body);
  const options = contentDiv.querySelector(":scope > .cmba-options");
  (options || contentDiv).appendChild(details);
}

export function createAssistantResponseElement(assistantDiv: HTMLDivElement, mid: string, working: boolean, actions: MessageElementActions): HTMLDivElement {
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
  if (!working) contentDiv.appendChild(createMessageOptions(mid, ["copy", "delete"], actions));
  assistantDiv.appendChild(iconDiv);
  assistantDiv.appendChild(contentDiv);
  return textDiv;
}

export function createAssistantDraftElement(container: HTMLElement, mid: string): HTMLDivElement | null {
  const assistantDiv = document.createElement("div");
  assistantDiv.id = mid;
  assistantDiv.classList.add("chat-md-bubble-assistant");
  container.appendChild(assistantDiv);

  return createAssistantResponseElement(assistantDiv, mid, true, {});
}

export function insertReasoningElem(el: HTMLElement): HTMLDivElement | null {
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

export function findMessageIndex(container: HTMLElement, id: string): number {
  return Array.from(container.children).findIndex((child) => (child as HTMLElement).id === id);
}
