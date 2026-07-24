<template>
  <div ref="composerRef" class="creation-composer" :class="[rootClass, { 'is-action-stacked-mobile': stackActionsOnMobile }]" @paste="emit('paste', $event)">
    <slot name="media"></slot>

    <textarea
      ref="textareaRef"
      :value="modelValue"
      class="creation-composer-textarea"
      :placeholder="placeholder"
      rows="1"
      @input="onInput"
      @keydown.enter="onEnter"
    ></textarea>

    <div class="creation-composer-actions">
      <div class="creation-composer-left-actions">
        <slot name="left-actions"></slot>

        <div v-if="modelReadonly" class="creation-composer-model-lock">
          <AppTooltip :text="modelReadonlyTooltip" placement="top">
            <span class="creation-composer-model-lock-label">{{ modelReadonlyLabel }}</span>
          </AppTooltip>
        </div>
        <div v-else class="creation-composer-model-select">
          <AppSelect
            :model-value="modelIndex"
            :options="modelOptions"
            :placeholder="modelPlaceholder"
            :disabled="modelDisabled"
            menu-class="creation-composer-select-menu"
            borderless
            @update:model-value="emit('update:modelIndex', Number($event ?? -1))"
          />
        </div>

        <AppTooltip :text="settingsTooltip" placement="top">
          <button class="creation-composer-settings-button" type="button" @click="emit('settings')">
            <SvgIcon :src="paramIcon" />
          </button>
        </AppTooltip>
      </div>

      <div class="creation-composer-right-actions">
        <slot name="right-actions-extra"></slot>
        <AppTooltip :text="sendTooltip" placement="top">
          <button class="creation-composer-send-button" :class="sendButtonClass" type="button" :disabled="sendDisabled" @click="emit('send')">
            <slot name="send-icon">
              <SvgIcon :src="arrowUpIcon" />
            </slot>
          </button>
        </AppTooltip>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import AppSelect, { type AppSelectOption } from "@/components/AppSelect.vue";
import AppTooltip from "@/components/AppTooltip.vue";
import SvgIcon from "@/components/SvgIcon.vue";
import arrowUpIcon from "@/assets/svg/arrowUp32.svg";
import paramIcon from "@/assets/svg/param24.svg";

type RootClass = string | Record<string, boolean> | Array<string | Record<string, boolean>>;

const props = withDefaults(
  defineProps<{
    modelValue: string;
    modelIndex: number | null;
    modelOptions: AppSelectOption[];
    modelPlaceholder?: string;
    modelDisabled?: boolean;
    modelReadonly?: boolean;
    modelReadonlyLabel?: string;
    modelReadonlyTooltip?: string;
    placeholder?: string;
    rootClass?: RootClass;
    sendDisabled?: boolean;
    sendButtonClass?: RootClass;
    sendTooltip?: string;
    settingsTooltip?: string;
    stackActionsOnMobile?: boolean;
  }>(),
  {
    modelPlaceholder: "",
    modelDisabled: false,
    modelReadonly: false,
    modelReadonlyLabel: "",
    modelReadonlyTooltip: "",
    placeholder: "",
    rootClass: undefined,
    sendDisabled: false,
    sendButtonClass: undefined,
    sendTooltip: "",
    settingsTooltip: "",
    stackActionsOnMobile: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
  "update:modelIndex": [value: number];
  input: [];
  paste: [event: ClipboardEvent];
  send: [];
  settings: [];
}>();

const composerRef = ref<HTMLElement | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);

function resizeTextarea() {
  const textarea = textareaRef.value;
  if (!textarea) return;
  textarea.style.height = "auto";
  if (!props.modelValue) {
    textarea.style.height = "";
    return;
  }
  textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
}

function onInput(event: Event) {
  emit("update:modelValue", (event.target as HTMLTextAreaElement).value);
  emit("input");
  nextTick(() => resizeTextarea());
}

function onEnter(event: KeyboardEvent) {
  if (event.isComposing) return;

  if (event.ctrlKey || event.metaKey) {
    event.preventDefault();
    emit("send");
    return;
  }

  event.preventDefault();
  emit("send");
}

function focus() {
  nextTick(() => textareaRef.value?.focus());
}

function getElement() {
  return composerRef.value;
}

watch(
  () => props.modelValue,
  (value) => {
    nextTick(() => resizeTextarea());
  },
);

defineExpose({
  focus,
  getElement,
  resizeTextarea,
});
</script>

<style scoped lang="scss">
.creation-composer {
  --creation-composer-control-size: 38px;
  --creation-composer-model-width: clamp(80px, calc(100vw - 240px), 240px);
  position: relative;
  z-index: 1;
  width: min(100%, 742px);
  pointer-events: auto;
  max-height: min(68vh, 620px);
  overflow-y: auto;
  padding: 14px 18px 12px;
  border: 1px solid oklch(var(--bc) / 0.27);
  border-radius: 42px;
  background: oklch(var(--b1) / 0.96);
  contain: layout paint;
}

.creation-composer-textarea {
  display: block;
  width: 100%;
  min-height: 36px;
  max-height: 188px;
  padding: 8px 0 6px;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  color: oklch(var(--bc));
  font-size: 16px;
  line-height: 1.5;
}

.creation-composer-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 4px 0 0 8px;
}

.creation-composer-left-actions,
.creation-composer-right-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.creation-composer-send-button {
  width: var(--creation-composer-control-size);
  height: var(--creation-composer-control-size);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background-color: oklch(var(--n));
  color: oklch(var(--nc));
  cursor: pointer;

  &:disabled {
    opacity: 0.36;
    cursor: not-allowed;
  }

  &.is-stopping {
    background-color: oklch(var(--er));
    color: oklch(var(--nc));
  }

  :deep(.svg-icon) {
    width: 20px;
    height: 20px;
  }
}

.creation-composer-settings-button {
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: oklch(var(--bc) / 0.6);
  cursor: pointer;

  &:hover {
    color: oklch(var(--bc));
  }

  :deep(.svg-icon) {
    width: 18px;
    height: 18px;
  }
}

.creation-composer-model-select {
  min-width: 0;
  width: var(--creation-composer-model-width);
  max-width: var(--creation-composer-model-width);

  :deep(.app-select-control) {
    min-height: 32px;
    height: 32px;
    padding: 0 28px 0 4px;
    border: 0 !important;
    outline: 0;
    border-radius: 8px;
    background: transparent;
    box-shadow: none;
    color: oklch(var(--bc));
    font-size: 14px;
    line-height: 1.2;
  }

  :deep(.app-select-control:hover) {
    background: oklch(var(--b2) / 0.36);
  }

  :deep(.app-select-control:focus),
  :deep(.app-select-control:focus-visible) {
    outline: none;
    border: 0 !important;
    box-shadow: none;
    background: oklch(var(--b2) / 0.36);
  }

  :deep(.app-select-button-label) {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.25;
  }

  :deep(.app-select-trigger) {
    right: 2px;
    width: 24px;
    height: 24px;
    border: 0;
    outline: none;
    background: transparent;
    box-shadow: none;
    color: oklch(var(--bc) / 0.42);
  }

  :deep(.app-select-trigger:focus-visible) {
    outline: none;
    box-shadow: none;
  }

  :deep(.app-select-caret) {
    border-left-width: 4px;
    border-right-width: 4px;
    border-top-width: 5px;
  }

  :deep(.app-select-menu) {
    min-width: 220px;
  }
}

.creation-composer-model-lock {
  width: var(--creation-composer-model-width);
  height: 32px;
  min-width: 0;
  padding: 0 4px;
  display: flex;
  align-items: center;
  border-radius: 8px;
  background: oklch(var(--b2) / 0.5);
  color: oklch(var(--bc));
  font-size: 16px;

  :deep(.app-tooltip-host),
  :deep(.app-tooltip-trigger) {
    min-width: 0;
    width: 100%;
  }
}

.creation-composer-model-lock-label {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 640px) {
  .creation-composer {
    --creation-composer-control-size: 36px;
    border-radius: 24px;
    padding: 12px 14px;
  }

  .creation-composer-actions {
    padding: 8px 0 0;
    gap: 6px;
  }

  .creation-composer-left-actions,
  .creation-composer-right-actions {
    gap: 6px;
  }

  .creation-composer-left-actions {
    flex: 1 1 auto;
    overflow: hidden;
  }

  .creation-composer-right-actions {
    flex: 0 0 auto;
  }

  .creation-composer-model-select {
    flex: 0 0 var(--creation-composer-model-width);
    width: var(--creation-composer-model-width);
    max-width: var(--creation-composer-model-width);

    :deep(.app-select-control) {
      font-size: 13px;
    }
  }

  .creation-composer-model-lock {
    flex: 0 0 var(--creation-composer-model-width);
    width: var(--creation-composer-model-width);
    max-width: var(--creation-composer-model-width);
    font-size: 13px;
  }
}

@media (max-width: 720px) {
  .creation-composer.is-action-stacked-mobile {
    .creation-composer-actions {
      align-items: stretch;
      flex-direction: column;
    }

    .creation-composer-left-actions,
    .creation-composer-right-actions {
      width: 100%;
    }

    .creation-composer-model-select {
      flex: 1 1 auto;
      max-width: none;
      width: auto;
    }

    .creation-composer-right-actions {
      justify-content: space-between;
    }
  }
}

:global(.creation-composer-select-menu) {
  max-height: min(280px, calc(100vh - 24px));
  min-width: 220px;
}

:global(.creation-composer-select-menu .app-select-group) {
  padding: 6px 9px 2px;
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0;
  text-transform: none;
}

:global(.creation-composer-select-menu .app-select-option) {
  min-height: 32px;
  padding: 0 10px;
  border-radius: 9px;
  font-size: 13px;
}

:global(.creation-composer-select-menu .app-select-empty) {
  min-height: 32px;
  padding: 0 10px;
}
</style>
