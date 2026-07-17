<template>
  <dialog ref="dialogRef" id="global_chat_file_preview_modal" class="modal global-chat-file-preview-modal" @click="onDialogClick" @cancel.prevent="close">
    <div class="modal-box cfp-shell" @click.stop>
      <header class="cfp-toolbar">
        <div class="cfp-title-wrap">
          <div class="cfp-title">{{ attachment?.name || t("common.preview") }}</div>
          <div class="cfp-meta">
            <span>{{ attachment?.kindLabel || "FILE" }}</span>
            <span>{{ attachment?.contentType || "text/plain" }}</span>
            <span>{{ formatChatFileSize(attachment?.size || 0) }}</span>
          </div>
        </div>

        <button class="cfp-close" type="button" :aria-label="t('common.close')" @click="close">
          <img class="cfp-close-icon" :src="closeIcon" alt="" />
        </button>
      </header>

      <div v-if="attachment?.truncated" class="cfp-note">
        {{ t("toast.fileContentTruncated") }}
      </div>

      <div class="cfp-note">
        {{ t("toast.filePreviewTextOnly") }}
      </div>

      <pre class="cfp-content">{{ attachment?.text || "" }}</pre>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useAppStore } from "@/store";
import { useI18n } from "vue-i18n";
import { formatChatFileSize } from "@/services";
import closeIcon from "@/assets/svg/close16.svg";

const dialogRef = ref<HTMLDialogElement | null>(null);
const store = useAppStore();
const { t } = useI18n();
const attachment = computed(() => store.state.modalChatAttachment);

function close() {
  dialogRef.value?.close();
  store.commit("setModalChatAttachment", null);
}

function onDialogClick(event: MouseEvent) {
  if (event.target === dialogRef.value) close();
}
</script>

<style scoped lang="scss">
.global-chat-file-preview-modal {
  .modal-box {
    width: min(92vw, 980px);
    max-width: 980px;
    max-height: 86vh;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 18px;
    background: oklch(var(--b1));
    box-shadow: 0 24px 90px oklch(var(--bc) / 0.24);
  }

  .cfp-toolbar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .cfp-title-wrap {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .cfp-title {
    font-size: 18px;
    font-weight: 700;
    color: oklch(var(--bc));
    word-break: break-word;
  }

  .cfp-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
    font-size: 12px;
    color: oklch(var(--bc) / 0.72);
  }

  .cfp-close {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: oklch(var(--bc) / 0.64);
    cursor: pointer;
    transition:
      background-color 0.18s ease,
      color 0.18s ease;

    &:hover,
    &:focus-visible {
      background: oklch(var(--b2));
      color: oklch(var(--bc));
      outline: none;
    }
  }

  .cfp-close-icon {
    display: block;
    width: 16px;
    height: 16px;
    flex: 0 0 auto;
  }

  .cfp-note {
    padding: 10px 12px;
    border-radius: 14px;
    background: oklch(var(--wa) / 0.12);
    color: oklch(var(--wa));
    font-size: 13px;
    line-height: 1.5;
  }

  .cfp-content {
    flex: 1 1 auto;
    margin: 0;
    padding: 16px;
    border-radius: 18px;
    overflow: auto;
    background: oklch(var(--b2));
    color: oklch(var(--bc));
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.65;
    font-size: 14px;
  }
}
</style>
