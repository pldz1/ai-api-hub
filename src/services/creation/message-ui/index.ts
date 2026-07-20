import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";

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
