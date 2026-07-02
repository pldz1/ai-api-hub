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

        <div class="cfp-toolbar-actions">
          <button class="btn btn-sm btn-ghost" type="button" @click="downloadAttachment">
            {{ t("common.download") }}
          </button>
          <button class="btn btn-sm btn-ghost" type="button" @click="close">
            {{ t("common.close") }}
          </button>
        </div>
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
import { useStore } from "vuex";
import { useI18n } from "vue-i18n";
import { dsAlert, saveBlobToLocal, saveTextToLocal } from "@/utils";
import { buildChatAttachmentDownloadFilename, formatChatFileSize } from "@/services";
import { getChatFileSource } from "@/services/app/storage";

const dialogRef = ref<HTMLDialogElement | null>(null);
const store = useStore();
const { t } = useI18n();
const attachment = computed(() => store.state.modalChatAttachment);

function close() {
  dialogRef.value?.close();
  store.dispatch("setModalChatAttachment", null);
}

async function downloadAttachment() {
  if (!attachment.value) return;

  const source = await getChatFileSource(attachment.value.id);
  const success = source
    ? await saveBlobToLocal(source, buildChatAttachmentDownloadFilename(attachment.value, true))
    : await saveTextToLocal(attachment.value.text, buildChatAttachmentDownloadFilename(attachment.value, false));
  if (!success) {
    dsAlert({ type: "error", message: t("toast.fileDownloadFailed") });
  }
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

  .cfp-toolbar-actions {
    flex: 0 0 auto;
    display: flex;
    gap: 8px;
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
