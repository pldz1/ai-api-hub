import { computed, nextTick, onBeforeUnmount, onMounted, ref, type ComputedRef, type Ref } from "vue";

export interface CreationUiMessage {
  id: string;
  role?: string;
  prompt?: string;
  attachments?: unknown[];
}

export interface CreationMessageTopic {
  id: string;
  title: string;
  detail?: string;
}

interface CreationMessageUiOptions<T extends CreationUiMessage> {
  messages: ComputedRef<T[]>;
  scrollRef: Ref<HTMLElement | null>;
  collapsedHeight?: number;
  userRole?: string;
}

const DEFAULT_COLLAPSED_HEIGHT = 200;

function buildTopicTitle(prompt: string | undefined, index: number) {
  const title = (prompt || "").replace(/\s+/g, " ").trim();
  if (!title) return `Prompt ${index + 1}`;
  return title.length > 72 ? `${title.slice(0, 72)}...` : title;
}

function buildTopicDetail(attachmentCount: number) {
  if (!attachmentCount) return "";
  return `${attachmentCount} attachment${attachmentCount > 1 ? "s" : ""}`;
}

function areSetsEqual(left: Set<string>, right: Set<string>) {
  if (left.size !== right.size) return false;
  for (const item of left) {
    if (!right.has(item)) return false;
  }
  return true;
}

export function useCreationMessageUi<T extends CreationUiMessage>({
  messages,
  scrollRef,
  collapsedHeight = DEFAULT_COLLAPSED_HEIGHT,
  userRole = "user",
}: CreationMessageUiOptions<T>) {
  const activeTopicId = ref("");
  const collapsibleMessageIds = ref(new Set<string>());
  const expandedMessageIds = ref(new Set<string>());
  const messageEls = new Map<string, HTMLElement>();
  const messageContentEls = new Map<string, HTMLElement>();
  let contentResizeObserver: ResizeObserver | null = null;
  let refreshFrame = 0;
  let activeTopicFrame = 0;
  let disposed = false;

  const topicSourceMessages = computed(() => {
    const userMessages = messages.value.filter((message) => message.role === userRole && message.prompt);
    if (userMessages.length) return userMessages;
    return messages.value.filter((message) => message.prompt);
  });

  const messageTopics = computed<CreationMessageTopic[]>(() =>
    topicSourceMessages.value.map((message, index) => ({
      id: message.id,
      title: buildTopicTitle(message.prompt, index),
      detail: buildTopicDetail(message.attachments?.length || 0),
    })),
  );

  const topicMessageIds = computed(() => new Set(topicSourceMessages.value.map((message) => message.id)));

  function updateActiveTopicFromScroll() {
    const container = scrollRef.value;
    if (!container || !messageEls.size) {
      const nextActiveId = messageTopics.value[0]?.id || "";
      if (activeTopicId.value !== nextActiveId) activeTopicId.value = nextActiveId;
      return;
    }

    const anchor = container.getBoundingClientRect().top + 36;
    let nextActiveId = messageTopics.value[0]?.id || "";
    let bestDistance = Number.POSITIVE_INFINITY;

    messageTopics.value.forEach((topic) => {
      const el = messageEls.get(topic.id);
      if (!el) return;
      const distance = Math.abs(el.getBoundingClientRect().top - anchor);
      if (distance < bestDistance) {
        bestDistance = distance;
        nextActiveId = topic.id;
      }
    });

    if (activeTopicId.value !== nextActiveId) activeTopicId.value = nextActiveId;
  }

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
      updateActiveTopicFromScroll();
    });
  }

  function scheduleActiveTopicUpdate() {
    if (disposed) return;
    if (activeTopicFrame) return;
    activeTopicFrame = window.requestAnimationFrame(() => {
      activeTopicFrame = 0;
      if (disposed) return;
      updateActiveTopicFromScroll();
    });
  }

  function registerMessage(id: string, role: string | undefined, el: unknown) {
    if (!(el instanceof HTMLElement)) {
      messageEls.delete(id);
      scheduleRefreshMessageUi();
      return;
    }

    if (role !== userRole && !topicMessageIds.value.has(id)) return;
    if (messageEls.get(id) === el) return;

    messageEls.set(id, el);
    scheduleRefreshMessageUi();
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

  function scrollToMessage(id: string) {
    const container = scrollRef.value;
    const el = messageEls.get(id);
    if (!container || !el) return;

    const top = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 16;
    container.scrollTo({ top, behavior: "smooth" });
    if (activeTopicId.value !== id) activeTopicId.value = id;
  }

  function onMessageScroll() {
    scheduleActiveTopicUpdate();
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
    if (activeTopicFrame) window.cancelAnimationFrame(activeTopicFrame);
    refreshFrame = 0;
    activeTopicFrame = 0;
    contentResizeObserver?.disconnect();
    contentResizeObserver = null;
    messageContentEls.clear();
    messageEls.clear();
  });

  return {
    activeTopicId,
    collapsibleMessageIds,
    expandedMessageIds,
    messageTopics,
    onMessageScroll,
    refreshMessageUi,
    registerMessage,
    registerMessageContent,
    scrollToMessage,
    toggleMessage,
  };
}
