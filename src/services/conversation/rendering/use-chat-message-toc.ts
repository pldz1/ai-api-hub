import { nextTick, onBeforeUnmount, onMounted, ref, type Ref } from "vue";

export interface ChatTocHeading { id: string; level: number; text: string }

const HEADING_SELECTOR = ".markdown-content h1, .markdown-content h2, .markdown-content h3, .markdown-content h4";
const ACTIVE_OFFSET = 88;

export function useChatMessageToc(scrollContainerRef: Ref<HTMLElement | null>) {
  const headings = ref<ChatTocHeading[]>([]);
  const activeHeadingId = ref("");
  const headingElements = new Map<string, HTMLElement>();
  let observer: MutationObserver | null = null;
  let refreshFrame = 0;

  function getActiveAssistant(container: HTMLElement): HTMLElement | null {
    const assistants = Array.from(container.querySelectorAll<HTMLElement>(".chat-md-bubble-assistant"))
      .filter((message) => message.querySelector(HEADING_SELECTOR));
    if (!assistants.length) return null;

    const rect = container.getBoundingClientRect();
    const readLine = rect.top + ACTIVE_OFFSET;
    let active = assistants[0];
    for (const assistant of assistants) {
      if (assistant.getBoundingClientRect().top <= readLine) active = assistant;
      else break;
    }
    if (container.scrollTop + container.clientHeight >= container.scrollHeight - 160) return assistants[assistants.length - 1] || active;
    return active;
  }

  function updateActive(container: HTMLElement) {
    if (!headings.value.length) { activeHeadingId.value = ""; return; }
    const readLine = container.getBoundingClientRect().top + ACTIVE_OFFSET;
    let nextId = headings.value[0].id;
    for (const heading of headings.value) {
      const element = headingElements.get(heading.id);
      if (element && element.getBoundingClientRect().top <= readLine) nextId = heading.id;
      else break;
    }
    activeHeadingId.value = nextId;
  }

  function refresh() {
    const container = scrollContainerRef.value;
    if (!container) return;
    const assistant = getActiveAssistant(container);
    headingElements.clear();
    if (!assistant) { headings.value = []; activeHeadingId.value = ""; return; }

    const assistantId = assistant.id || "assistant";
    headings.value = Array.from(assistant.querySelectorAll<HTMLElement>(HEADING_SELECTOR))
      .filter((element) => !element.closest(".cmba-reasoning-content") && Boolean(element.textContent?.trim()))
      .map((element, index) => {
        const level = Number(element.tagName.slice(1)) || 2;
        const id = `${assistantId}-heading-${index}-${level}`;
        headingElements.set(id, element);
        return { id, level, text: element.textContent?.trim() || "" };
      });
    updateActive(container);
  }

  function scheduleRefresh() {
    if (refreshFrame) return;
    refreshFrame = requestAnimationFrame(() => { refreshFrame = 0; refresh(); });
  }

  function scrollToHeading(id: string) {
    const container = scrollContainerRef.value;
    const element = headingElements.get(id);
    if (!container || !element) return;
    const top = element.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 16;
    container.scrollTo({ top, behavior: "smooth" });
    activeHeadingId.value = id;
  }

  function connect() {
    const container = scrollContainerRef.value;
    if (!container) return;
    container.addEventListener("scroll", scheduleRefresh, { passive: true });
    observer = new MutationObserver(scheduleRefresh);
    observer.observe(container, { childList: true, subtree: true, characterData: true });
    refresh();
  }

  onMounted(() => nextTick(connect));
  onBeforeUnmount(() => {
    scrollContainerRef.value?.removeEventListener("scroll", scheduleRefresh);
    observer?.disconnect();
    if (refreshFrame) cancelAnimationFrame(refreshFrame);
  });

  return { headings, activeHeadingId, refresh, scheduleRefresh, scrollToHeading };
}
