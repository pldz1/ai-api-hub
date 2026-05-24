<template>
  <!-- This component renders a dropdown menu with a custom trigger. -->
  <!-- Expose the trigger slot while forwarding inherited attributes. -->
  <div ref="triggerRef" class="app-dropdown-trigger" v-bind="attrs">
    <slot name="trigger" :toggle="toggleOpen" :open="open" />
  </div>
  <!-- Teleport the popup menu to the document body for stable positioning. -->
  <Teleport to="body">
    <div v-if="open" ref="menuRef" class="app-dropdown-menu" :style="menuStyle">
      <!-- Prefer a fully custom menu body when the default slot is provided. -->
      <slot v-if="$slots.default" :close="closeMenu" />
      <!-- Fall back to rendering a simple action list from the items prop. -->
      <template v-else>
        <button v-for="item in items" :key="item.key" class="app-dropdown-item" :class="{ active: item.active, danger: item.danger }" @click="selectItem(item)">
          <SvgIcon v-if="item.icon" class="app-dropdown-item-icon" :src="item.icon" />
          <span class="app-dropdown-item-label">{{ item.label }}</span>
        </button>
      </template>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useAttrs } from "vue";
import SvgIcon from "@/components/SvgIcon.vue";

defineOptions({ inheritAttrs: false });

type DropdownPlacement = "bottom-start" | "bottom-end" | "top-start" | "top-end";

type DropdownItem = {
  key: string;
  label: string;
  icon?: string;
  active?: boolean;
  danger?: boolean;
  value?: string;
};

const props = withDefaults(
  defineProps<{
    items?: DropdownItem[];
    placement?: DropdownPlacement;
    width?: number;
  }>(),
  {
    items: () => [],
    placement: "bottom-start",
    width: 160,
  },
);

const emit = defineEmits<{
  select: [item: DropdownItem];
}>();

const attrs = useAttrs();
const triggerRef = ref<HTMLElement | null>(null);
const menuRef = ref<HTMLElement | null>(null);
const open = ref(false);
const position = ref({ top: 0, left: 0 });

const menuStyle = computed(() => ({
  top: `${position.value.top}px`,
  left: `${position.value.left}px`,
  minWidth: `${props.width}px`,
}));

const updatePosition = () => {
  const triggerEl = triggerRef.value;
  if (!triggerEl) return;
  const rect = triggerEl.getBoundingClientRect();
  const scrollY = window.scrollY;
  const scrollX = window.scrollX;

  const menuHeight = menuRef.value?.offsetHeight || 0;
  const top = props.placement.startsWith("top") ? rect.top + scrollY - menuHeight - 4 : rect.bottom + scrollY + 4;
  let left = rect.left + scrollX;

  if (props.placement.endsWith("end")) {
    left = rect.right + scrollX - props.width;
  }

  position.value = { top, left };
};

const onDocumentClick = (event: MouseEvent) => {
  const triggerEl = triggerRef.value;
  const menuEl = menuRef.value;
  const target = event.target;
  if (!(target instanceof Node)) return;
  if (triggerEl?.contains(target) || menuEl?.contains(target)) return;
  closeMenu();
};

const bindViewportEvents = () => {
  document.addEventListener("click", onDocumentClick);
  window.addEventListener("scroll", updatePosition, true);
  window.addEventListener("resize", updatePosition);
};

const unbindViewportEvents = () => {
  document.removeEventListener("click", onDocumentClick);
  window.removeEventListener("scroll", updatePosition, true);
  window.removeEventListener("resize", updatePosition);
};

const openMenu = async () => {
  open.value = true;
  await nextTick();
  updatePosition();
  bindViewportEvents();
};

const closeMenu = () => {
  open.value = false;
  unbindViewportEvents();
};

const toggleOpen = async () => {
  if (open.value) {
    closeMenu();
    return;
  }
  await openMenu();
};

const selectItem = (item: DropdownItem) => {
  emit("select", item);
  closeMenu();
};

onBeforeUnmount(() => {
  unbindViewportEvents();
});
</script>

<style scoped>
.app-dropdown-trigger {
  display: inline-flex;
}

.app-dropdown-menu {
  position: absolute;
  z-index: 5000;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px;
  border-radius: 12px;
  border: 1px solid oklch(var(--bc) / 0.12);
  background: oklch(var(--b1) / 0.985);
  box-shadow:
    0 12px 24px oklch(var(--bc) / 0.1),
    0 2px 6px oklch(var(--bc) / 0.04);
}

.app-dropdown-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: none;
  border-radius: 10px;
  background: transparent;
  text-align: left;
  font-size: 13px;
  font-weight: 600;
  color: oklch(var(--bc) / 0.86);
}

.app-dropdown-item-icon {
  width: 18px;
  height: 18px;
  color: oklch(var(--bc) / 0.62);
}

.app-dropdown-item-label {
  min-width: 0;
  flex: 1 1 auto;
}

.app-dropdown-item:hover,
.app-dropdown-item.active {
  background: oklch(var(--b2) / 0.92);
  color: oklch(var(--bc));
}

.app-dropdown-item:hover .app-dropdown-item-icon,
.app-dropdown-item.active .app-dropdown-item-icon {
  color: oklch(var(--bc));
}

.app-dropdown-item.danger {
  color: oklch(var(--er));
}
</style>
