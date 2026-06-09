import { nextTick, onBeforeUnmount, onMounted, ref, type Ref } from "vue";

export interface ChatTocHeading {
  id: string;
  level: number;
  text: string;
}

const HEADING_SELECTOR = ".markdown-content h1, .markdown-content h2, .markdown-content h3, .markdown-content h4";
const BOTTOM_FOLLOW_THRESHOLD = 180;
const ACTIVE_HEADING_OFFSET = 96;

function getAssistantMessages(container: HTMLElement): HTMLElement[] {
  return Array.from(container.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement && child.classList.contains("chat-md-bubble-assistant"),
  );
}

function getHeadingElements(messageEl: HTMLElement): HTMLElement[] {
  return Array.from(messageEl.querySelectorAll(HEADING_SELECTOR)).filter((el): el is HTMLElement => {
    const text = el.textContent?.trim() || "";
    return Boolean(text) && !el.closest(".cmba-reasoning-content");
  });
}

function isNearBottom(container: HTMLElement): boolean {
  return container.scrollTop + container.clientHeight >= container.scrollHeight - BOTTOM_FOLLOW_THRESHOLD;
}

function getVisibleScore(messageEl: HTMLElement, containerRect: DOMRect): number {
  const rect = messageEl.getBoundingClientRect();
  const overlap = Math.min(rect.bottom, containerRect.bottom) - Math.max(rect.top, containerRect.top);
  if (overlap <= 0) return 0;
  return overlap / Math.max(1, Math.min(rect.height, containerRect.height));
}

function selectActiveMessage(container: HTMLElement): HTMLElement | null {
  const messagesWithHeadings = getAssistantMessages(container).filter((el) => getHeadingElements(el).length > 0);
  if (!messagesWithHeadings.length) return null;

  const latestMessage = messagesWithHeadings[messagesWithHeadings.length - 1];
  const draftMessage = messagesWithHeadings.find((el) => el.dataset.chatDraft === "true") || null;
  if (isNearBottom(container)) return draftMessage || latestMessage;

  const containerRect = container.getBoundingClientRect();
  let bestMessage: HTMLElement | null = null;
  let bestScore = 0;

  for (const messageEl of messagesWithHeadings) {
    const score = getVisibleScore(messageEl, containerRect);
    if (score > bestScore) {
      bestScore = score;
      bestMessage = messageEl;
    }
  }

  if (bestMessage && bestScore > 0.08) return bestMessage;

  const readLine = containerRect.top + ACTIVE_HEADING_OFFSET;
  let nearestMessage = messagesWithHeadings[0];
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const messageEl of messagesWithHeadings) {
    const rect = messageEl.getBoundingClientRect();
    const distance = rect.top <= readLine ? Math.abs(readLine - rect.top) : Math.abs(rect.top - readLine) + containerRect.height;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestMessage = messageEl;
    }
  }
  return nearestMessage;
}

export function useChatMessageToc(scrollContainerRef: Ref<HTMLElement | null>) {
  const headings = ref<ChatTocHeading[]>([]);
  const activeHeadingId = ref("");
  const activeMessageId = ref("");
  const headingElements = new Map<string, HTMLElement>();
  let observer: MutationObserver | null = null;
  let refreshFrame = 0;
  let scrollFrame = 0;

  function updateActiveHeading(container: HTMLElement): void {
    if (!headings.value.length) {
      activeHeadingId.value = "";
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const readLine = containerRect.top + ACTIVE_HEADING_OFFSET;
    let nextActiveId = headings.value[0].id;

    for (const heading of headings.value) {
      const el = headingElements.get(heading.id);
      if (!el) continue;
      if (el.getBoundingClientRect().top <= readLine) {
        nextActiveId = heading.id;
      } else {
        break;
      }
    }

    activeHeadingId.value = nextActiveId;
  }

  function refresh(): void {
    const container = scrollContainerRef.value;
    if (!container) return;

    const messageEl = selectActiveMessage(container);
    headingElements.clear();

    if (!messageEl) {
      activeMessageId.value = "";
      headings.value = [];
      activeHeadingId.value = "";
      return;
    }

    activeMessageId.value = messageEl.id || "";
    const nextHeadings = getHeadingElements(messageEl).map((el, index) => {
      const text = el.textContent?.trim() || "";
      const level = Number(el.tagName.slice(1)) || 2;
      const id = `${activeMessageId.value || "assistant"}-${index}-${level}`;
      headingElements.set(id, el);
      return { id, level, text };
    });

    headings.value = nextHeadings;
    updateActiveHeading(container);
  }

  function scheduleRefresh(): void {
    if (refreshFrame) return;
    refreshFrame = requestAnimationFrame(() => {
      refreshFrame = 0;
      refresh();
    });
  }

  function handleScroll(): void {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      refresh();
    });
  }

  function scrollToHeading(id: string): void {
    const el = headingElements.get(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function connect(): void {
    const container = scrollContainerRef.value;
    if (!container) return;

    container.addEventListener("scroll", handleScroll, { passive: true });
    observer = new MutationObserver(scheduleRefresh);
    observer.observe(container, { childList: true, subtree: true, characterData: true });
    refresh();
  }

  onMounted(() => {
    nextTick(connect);
  });

  onBeforeUnmount(() => {
    const container = scrollContainerRef.value;
    container?.removeEventListener("scroll", handleScroll);
    observer?.disconnect();
    observer = null;
    if (refreshFrame) cancelAnimationFrame(refreshFrame);
    if (scrollFrame) cancelAnimationFrame(scrollFrame);
    refreshFrame = 0;
    scrollFrame = 0;
  });

  return {
    headings,
    activeHeadingId,
    activeMessageId,
    refresh,
    scheduleRefresh,
    scrollToHeading,
  };
}
