import { computed, nextTick, onBeforeUnmount, onMounted, ref, type ComputedRef, type Ref } from "vue";

export interface CreationTopicMessage {
  id: string;
  role?: string;
  prompt?: string;
  attachments?: unknown[];
}

export function useCreationMessageTopics<T extends CreationTopicMessage>(messages: ComputedRef<T[]>, scrollRef: Ref<HTMLElement | null>) {
  const activeTopicId = ref("");
  let scrollFrame = 0;

  const sourceMessages = computed(() => {
    const userMessages = messages.value.filter((message) => message.role === "user");
    return userMessages.length ? userMessages : messages.value.filter((message) => message.prompt);
  });
  const messageTopics = computed(() => sourceMessages.value.map((message, index) => {
    const prompt = (message.prompt || "").replace(/\s+/g, " ").trim();
    const title = prompt ? (prompt.length > 72 ? `${prompt.slice(0, 72)}...` : prompt) : `Prompt ${index + 1}`;
    const attachmentCount = message.attachments?.length || 0;
    return { id: message.id, title, detail: attachmentCount ? `${attachmentCount} attachment${attachmentCount > 1 ? "s" : ""}` : "" };
  }));

  function updateActiveTopic() {
    const container = scrollRef.value;
    if (!container || !messageTopics.value.length) { activeTopicId.value = messageTopics.value[0]?.id || ""; return; }
    const anchor = container.getBoundingClientRect().top + 48;
    let nextId = messageTopics.value[0].id;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const topic of messageTopics.value) {
      const element = container.querySelector(`#${CSS.escape(topic.id)}`) as HTMLElement | null;
      if (!element) continue;
      const distance = Math.abs(element.getBoundingClientRect().top - anchor);
      if (distance < bestDistance) { bestDistance = distance; nextId = topic.id; }
    }
    activeTopicId.value = nextId;
  }

  function onMessageScroll() {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => { scrollFrame = 0; updateActiveTopic(); });
  }

  function scrollToMessage(id: string) {
    const container = scrollRef.value;
    const element = container?.querySelector(`#${CSS.escape(id)}`) as HTMLElement | null;
    if (!container || !element) return;
    const top = element.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 16;
    container.scrollTo({ top, behavior: "smooth" });
    activeTopicId.value = id;
  }

  onMounted(() => nextTick(updateActiveTopic));
  onBeforeUnmount(() => { if (scrollFrame) cancelAnimationFrame(scrollFrame); });

  return { activeTopicId, messageTopics, onMessageScroll, scrollToMessage, updateActiveTopic };
}

interface CreationMessageUiOptions {
  collapsedHeight?: number;
}

const DEFAULT_COLLAPSED_HEIGHT = 200;

function areSetsEqual(left: Set<string>, right: Set<string>) {
  if (left.size !== right.size) return false;
  for (const item of left) {
    if (!right.has(item)) return false;
  }
  return true;
}

export function useCreationMessageUi({ collapsedHeight = DEFAULT_COLLAPSED_HEIGHT }: CreationMessageUiOptions = {}) {
  const collapsibleMessageIds = ref(new Set<string>());
  const expandedMessageIds = ref(new Set<string>());
  const messageContentEls = new Map<string, HTMLElement>();
  let contentResizeObserver: ResizeObserver | null = null;
  let refreshFrame = 0;
  let disposed = false;

  function updateCollapseState() {
    const nextCollapsibleIds = new Set<string>();
    messageContentEls.forEach((el, id) => {
      if (el.scrollHeight > collapsedHeight) nextCollapsibleIds.add(id);
    });

    if (!areSetsEqual(collapsibleMessageIds.value, nextCollapsibleIds)) {
      collapsibleMessageIds.value = nextCollapsibleIds;
    }

    const nextExpandedIds = new Set(Array.from(expandedMessageIds.value).filter((id) => nextCollapsibleIds.has(id)));
    if (!areSetsEqual(expandedMessageIds.value, nextExpandedIds)) {
      expandedMessageIds.value = nextExpandedIds;
    }
  }

  function scheduleRefreshMessageUi() {
    if (disposed) return;
    if (refreshFrame) return;
    refreshFrame = window.requestAnimationFrame(() => {
      refreshFrame = 0;
      if (disposed) return;
      updateCollapseState();
    });
  }

  function registerMessageContent(id: string, el: unknown) {
    const prevEl = messageContentEls.get(id);
    if (prevEl && prevEl !== el) contentResizeObserver?.unobserve(prevEl);

    if (!(el instanceof HTMLElement)) {
      messageContentEls.delete(id);
      scheduleRefreshMessageUi();
      return;
    }

    if (prevEl === el) return;
    messageContentEls.set(id, el);
    contentResizeObserver?.observe(el);
    scheduleRefreshMessageUi();
  }

  function toggleMessage(id: string) {
    const nextExpandedIds = new Set(expandedMessageIds.value);
    if (nextExpandedIds.has(id)) {
      nextExpandedIds.delete(id);
      messageContentEls.get(id)?.scrollTo({ top: 0 });
    } else {
      nextExpandedIds.add(id);
    }
    expandedMessageIds.value = nextExpandedIds;
  }

  function refreshMessageUi() {
    nextTick(() => {
      if (!disposed) scheduleRefreshMessageUi();
    });
  }

  onMounted(() => {
    disposed = false;
    if (window.ResizeObserver) {
      contentResizeObserver = new ResizeObserver(scheduleRefreshMessageUi);
      messageContentEls.forEach((el) => contentResizeObserver?.observe(el));
    }
    refreshMessageUi();
  });

  onBeforeUnmount(() => {
    disposed = true;
    if (refreshFrame) window.cancelAnimationFrame(refreshFrame);
    refreshFrame = 0;
    contentResizeObserver?.disconnect();
    contentResizeObserver = null;
    messageContentEls.clear();
  });

  return {
    collapsibleMessageIds,
    expandedMessageIds,
    refreshMessageUi,
    registerMessageContent,
    toggleMessage,
  };
}
