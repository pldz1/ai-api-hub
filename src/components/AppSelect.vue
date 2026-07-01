<template>
  <div
    ref="rootRef"
    class="app-select"
    :class="{ 'app-select-open': open, 'app-select-searchable': searchable, 'app-select-disabled': disabled, 'app-select-open-upward': openDirection === 'up' }"
  >
    <input
      v-if="searchable"
      :value="searchText"
      type="text"
      class="input input-bordered w-full app-select-control app-select-input"
      :placeholder="placeholder"
      :disabled="disabled"
      autocomplete="off"
      @focus="openMenu"
      @input="handleInput"
      @keydown.down.prevent="highlightNextOption"
      @keydown.up.prevent="highlightPreviousOption"
      @keydown.enter.prevent="selectHighlightedOption"
      @keydown.esc.prevent="closeMenu"
    />
    <button
      v-else
      type="button"
      class="input input-bordered w-full app-select-control app-select-button"
      :aria-expanded="open"
      :disabled="disabled"
      @click="toggleMenu"
      @keydown.down.prevent="highlightNextOption"
      @keydown.up.prevent="highlightPreviousOption"
      @keydown.enter.prevent="selectHighlightedOption"
      @keydown.esc.prevent="closeMenu"
    >
      <span class="app-select-button-label">{{ selectedLabel || placeholder }}</span>
    </button>

    <button
      type="button"
      class="app-select-trigger"
      :aria-expanded="open"
      :aria-label="searchable ? 'Toggle options' : 'Open options'"
      :disabled="disabled"
      @click="toggleMenu"
    >
      <span class="app-select-caret"></span>
    </button>
  </div>
  <Teleport to="body">
    <div v-if="open" ref="menuRef" class="app-select-menu" :style="menuStyle">
      <template v-if="flattenedOptions.length > 0">
        <template v-for="item in flattenedOptions" :key="item.key">
          <div v-if="item.type === 'group'" class="app-select-group">
            {{ item.label }}
          </div>
          <button
            v-else
            type="button"
            class="app-select-option"
            :class="{ active: item.optionIndex === highlightedIndex, selected: item.option.value === modelValue }"
            @mousedown.prevent="selectOption(item.option.value)"
          >
            {{ item.option.label }}
          </button>
        </template>
      </template>
      <div v-else class="app-select-empty">
        {{ emptyText }}
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

export type AppSelectOption = {
  label: string;
  value: string | number;
  group?: string;
};

type AppSelectValue = string | number | null;
type AppSelectMenuItem =
  | { type: "group"; key: string; label: string }
  | { type: "option"; key: string; option: AppSelectOption; optionIndex: number };

const props = withDefaults(
  defineProps<{
    modelValue: AppSelectValue;
    options: AppSelectOption[];
    placeholder?: string;
    searchable?: boolean;
    allowCustomValue?: boolean;
    emptyText?: string;
    disabled?: boolean;
  }>(),
  {
    placeholder: "",
    searchable: false,
    allowCustomValue: false,
    emptyText: "No options",
    disabled: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: AppSelectValue];
}>();

const rootRef = ref<HTMLElement | null>(null);
const menuRef = ref<HTMLElement | null>(null);
const open = ref(false);
const openDirection = ref<"down" | "up">("down");
const highlightedIndex = ref(-1);
const searchText = ref(String(props.modelValue ?? ""));
const menuPosition = ref({ top: 0, left: 0, minWidth: 0 });

const normalizedModelValue = computed<AppSelectValue>(() => props.modelValue ?? null);
const selectedOption = computed(() => props.options.find((option) => option.value === normalizedModelValue.value) || null);
const selectedLabel = computed(() => {
  if (selectedOption.value) return selectedOption.value.label;
  if (props.searchable && props.allowCustomValue) return normalizedModelValue.value ?? "";
  return "";
});
const filteredOptions = computed(() => {
  if (!props.searchable) return props.options;
  const keyword = searchText.value.trim().toLowerCase();
  if (!keyword) return props.options;
  return props.options.filter((option) => option.label.toLowerCase().includes(keyword) || String(option.value).toLowerCase().includes(keyword));
});
const menuStyle = computed(() => ({
  top: `${menuPosition.value.top}px`,
  left: `${menuPosition.value.left}px`,
  minWidth: `${menuPosition.value.minWidth}px`,
}));
const flattenedOptions = computed<AppSelectMenuItem[]>(() => {
  const items: AppSelectMenuItem[] = [];
  let currentGroup = "";
  let optionIndex = 0;
  filteredOptions.value.forEach((option) => {
    const nextGroup = option.group || "";
    if (nextGroup && nextGroup !== currentGroup) {
      items.push({ type: "group", key: `group:${nextGroup}`, label: nextGroup });
      currentGroup = nextGroup;
    }
    items.push({
      type: "option",
      key: `option:${nextGroup}:${String(option.value)}`,
      option,
      optionIndex,
    });
    optionIndex += 1;
  });
  return items;
});

function syncHighlightedIndex() {
  const selectedIndex = filteredOptions.value.findIndex((option) => option.value === normalizedModelValue.value);
  highlightedIndex.value = selectedIndex >= 0 ? selectedIndex : filteredOptions.value.length > 0 ? 0 : -1;
}

function openMenu() {
  if (props.disabled) return;
  open.value = true;
  syncHighlightedIndex();
  nextTick(() => updateMenuPlacement());
}

function closeMenu() {
  open.value = false;
  highlightedIndex.value = -1;
  openDirection.value = "down";
  searchText.value = String(normalizedModelValue.value ?? "");
}

function toggleMenu() {
  if (props.disabled) return;
  if (open.value) {
    closeMenu();
    return;
  }
  openMenu();
}

function updateValue(value: AppSelectValue) {
  emit("update:modelValue", value);
  searchText.value = String(value ?? "");
}

function handleInput(event: Event) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  searchText.value = target.value;
  if (props.allowCustomValue) {
    updateValue(target.value.trim());
  }
  openMenu();
}

function selectOption(value: string | number) {
  updateValue(value);
  closeMenu();
}

function highlightNextOption() {
  if (!open.value) {
    openMenu();
    return;
  }
  if (filteredOptions.value.length === 0) return;
  highlightedIndex.value = highlightedIndex.value >= filteredOptions.value.length - 1 ? 0 : highlightedIndex.value + 1;
}

function highlightPreviousOption() {
  if (!open.value) {
    openMenu();
    return;
  }
  if (filteredOptions.value.length === 0) return;
  highlightedIndex.value = highlightedIndex.value <= 0 ? filteredOptions.value.length - 1 : highlightedIndex.value - 1;
}

function selectHighlightedOption() {
  if (!open.value) {
    openMenu();
    return;
  }
  const option = filteredOptions.value[highlightedIndex.value];
  if (option) {
    selectOption(option.value);
    return;
  }
  if (props.searchable && props.allowCustomValue) {
    updateValue(searchText.value.trim());
  }
  closeMenu();
}

function handleDocumentMouseDown(event: MouseEvent) {
  const target = event.target;
  if (!(target instanceof Node)) return;
  if (rootRef.value?.contains(target)) return;
  closeMenu();
}

function updateMenuDirection() {
  const rootEl = rootRef.value;
  const menuEl = menuRef.value;
  if (!rootEl || !menuEl) return;

  const rootRect = rootEl.getBoundingClientRect();
  const menuHeight = menuEl.offsetHeight;
  const spaceBelow = window.innerHeight - rootRect.bottom;
  const spaceAbove = rootRect.top;

  if (spaceBelow < menuHeight + 12 && spaceAbove > spaceBelow) {
    openDirection.value = "up";
    return;
  }

  openDirection.value = "down";
}

function updateMenuPlacement() {
  const rootEl = rootRef.value;
  const menuEl = menuRef.value;
  if (!rootEl || !menuEl) return;

  const rootRect = rootEl.getBoundingClientRect();
  menuPosition.value = {
    top: rootRect.bottom + window.scrollY + 8,
    left: rootRect.left + window.scrollX,
    minWidth: rootRect.width,
  };

  updateMenuDirection();

  const menuHeight = menuEl.offsetHeight;
  const menuWidth = Math.max(menuEl.offsetWidth, rootRect.width);
  const viewportPadding = 8;

  let top = rootRect.bottom + window.scrollY + 8;
  if (openDirection.value === "up") {
    top = rootRect.top + window.scrollY - menuHeight - 8;
  }

  const minTop = window.scrollY + viewportPadding;
  if (top < minTop) top = minTop;

  let left = rootRect.left + window.scrollX;
  const maxLeft = window.scrollX + window.innerWidth - menuWidth - viewportPadding;
  if (left > maxLeft) left = Math.max(window.scrollX + viewportPadding, maxLeft);

  menuPosition.value = {
    top,
    left,
    minWidth: rootRect.width,
  };
}

function handleViewportChange() {
  if (!open.value) return;
  updateMenuPlacement();
}

onMounted(() => {
  document.addEventListener("mousedown", handleDocumentMouseDown);
  window.addEventListener("resize", handleViewportChange);
  window.addEventListener("scroll", handleViewportChange, true);
});

onBeforeUnmount(() => {
  document.removeEventListener("mousedown", handleDocumentMouseDown);
  window.removeEventListener("resize", handleViewportChange);
  window.removeEventListener("scroll", handleViewportChange, true);
});

watch(
  () => props.modelValue,
  (value) => {
    searchText.value = String(value ?? "");
  },
  { immediate: true },
);

watch(
  () => filteredOptions.value,
  async () => {
    if (!open.value) return;
    await nextTick();
    syncHighlightedIndex();
    updateMenuPlacement();
  },
  { deep: true },
);
</script>

<style scoped lang="scss">
.app-select {
  position: relative;
}

.app-select-control {
  min-height: 46px;
  padding-right: 3rem;
}

.app-select-button {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  text-align: left;
  cursor: pointer;
}

.app-select-button-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-select-trigger {
  position: absolute;
  right: 12px;
  top: 50%;
  width: 28px;
  height: 28px;
  border: 0;
  background: transparent;
  color: oklch(var(--bc) / 0.72);
  cursor: pointer;
  transform: translateY(-50%);
}

.app-select-caret {
  display: inline-block;
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 8px solid currentColor;
  transition: transform 0.16s ease;
}

.app-select-open .app-select-caret {
  transform: rotate(180deg);
}

.app-select-menu {
  position: absolute;
  z-index: 5000;
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: min(280px, calc(100vh - 24px));
  overflow-y: auto;
  padding: 6px;
  border: 1px solid oklch(var(--bc) / 0.08);
  border-radius: 16px;
  background: oklch(var(--b1) / 0.98);
  backdrop-filter: blur(18px);
  box-shadow:
    0 18px 40px oklch(0 0 0 / 0.16),
    0 3px 12px oklch(0 0 0 / 0.06);
  scrollbar-width: thin;
  scrollbar-color: oklch(var(--bc) / 0.18) transparent;
}

.app-select-menu::-webkit-scrollbar {
  width: 6px;
}

.app-select-menu::-webkit-scrollbar-track {
  background: transparent;
}

.app-select-menu::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: oklch(var(--bc) / 0.18);
}

.app-select-group {
  padding: 8px 12px 4px;
  color: oklch(var(--bc) / 0.52);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.app-select-option {
  width: 100%;
  min-height: 44px;
  display: flex;
  align-items: center;
  padding: 0 14px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: oklch(var(--bc));
  font-size: 14px;
  line-height: 1.2;
  text-align: left;
  cursor: pointer;
  transition:
    background-color 0.14s ease,
    color 0.14s ease,
    transform 0.14s ease;

  &:hover,
  &.active {
    background: oklch(var(--b2) / 0.88);
  }

  &.selected {
    background: linear-gradient(180deg, oklch(var(--b2)) 0%, oklch(var(--b2) / 0.94) 100%);
    color: oklch(var(--p));
    font-weight: 600;
  }
}

.app-select-empty {
  min-height: 44px;
  display: flex;
  align-items: center;
  padding: 0 14px;
  color: oklch(var(--bc) / 0.62);
  font-size: 13px;
}

.app-select-disabled {
  opacity: 0.72;
}

.app-select-disabled .app-select-button,
.app-select-disabled .app-select-trigger {
  cursor: not-allowed;
}

@media (max-width: 720px) {
  .app-select-control {
    min-height: 44px;
  }

  .app-select-trigger {
    right: 10px;
  }
}
</style>
