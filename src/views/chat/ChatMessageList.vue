<template>
  <div class="chat-message-list">
    <template v-for="(message, messageIndex) in messages" :key="message.mid">
      <article v-if="message.role === 'user'" :id="message.mid" class="chat-md-bubble-user">
        <div class="cmbu-user-content">
          <div class="cmbu-content-area">
            <div class="cmbu-content-body">
              <div v-if="message.attachments?.length" class="cmbu-file-area">
                <div v-for="attachment in message.attachments" :key="attachment.id" class="cmbu-file-item">
                  <div class="cmbu-file-kind">{{ String(attachment.kindLabel || 'FILE').toUpperCase() }}</div>
                  <button class="cmbu-file-card" type="button" @click="previewAttachment(attachment)">
                    <span class="cmbu-file-label">{{ attachment.name }}</span>
                  </button>
                  <button class="cmbu-file-action" type="button" :aria-label="t('tooltip.downloadAttachment')" @click="downloadAttachment(attachment)">
                    <SvgIcon :src="saveIcon" />
                  </button>
                </div>
              </div>

              <div v-if="imageParts(message).length" class="cmbu-img-area">
                <img
                  v-for="part in imageParts(message)"
                  :key="part.image_url.url"
                  class="cmbu-item"
                  :src="part.image_url.url"
                  alt=""
                  @click="previewImage(part.image_url.url)"
                />
              </div>

              <template v-if="editingMid === message.mid">
                <textarea ref="editTextareaRef" v-model="editingText" class="chat-message-edit-textarea" @keydown.esc="cancelEdit"></textarea>
                <p class="chat-message-edit-note">{{ t('chat.editReplacesFollowing') }}</p>
              </template>
              <p v-else class="cmbu-content-text">{{ textContent(message) }}</p>
            </div>
          </div>

          <div class="cmbu-options">
            <template v-if="editingMid === message.mid">
              <button class="chat-message-text-action" type="button" @click="cancelEdit">{{ t('common.cancel') }}</button>
              <button class="chat-message-text-action is-primary" type="button" :disabled="!editingText.trim()" @click="saveEdit(message.mid || '')">
                {{ t('chat.saveAndRegenerate') }}
              </button>
            </template>
            <template v-else>
              <button
                v-if="messageIndex === messages.length - 1 && !runtime?.pending"
                class="chat-md-bubble-options-button"
                type="button"
                :aria-label="t('chat.generateAnswer')"
                @click="$emit('retry')"
              >
                <SvgIcon :src="regenerateIcon" />
              </button>
              <button class="chat-md-bubble-options-button" type="button" :aria-label="t('chat.editMessage')" @click="startEdit(message)">
                <SvgIcon :src="editIcon" />
              </button>
              <button class="chat-md-bubble-options-button" type="button" :aria-label="t('chat.deleteFromHere')" @click="$emit('delete-from', message.mid || '')">
                <SvgIcon :src="deleteIcon" />
              </button>
            </template>
          </div>
        </div>
      </article>

      <article v-else :id="message.mid" class="chat-md-bubble-assistant" :class="{ 'is-error': message.meta?.isContextBlocked }">
        <div class="cmba-assistant-content">
          <div v-if="message.reasoning_content" class="cmba-reasoning-content">
            <details>
              <summary>{{ t('tooltip.reasoning') }}</summary>
              <MarkdownBlock :content="message.reasoning_content" />
            </details>
          </div>
          <MarkdownBlock :content="textContent(message)" />
          <div class="cmba-options">
            <button class="chat-md-bubble-options-button" type="button" :aria-label="t('tooltip.copyText')" @click="copyMessage(message)">
              <SvgIcon :src="copyIcon" />
            </button>
            <button class="chat-md-bubble-options-button" type="button" :aria-label="t('chat.regenerateAnswer')" @click="$emit('regenerate', message.mid || '')">
              <SvgIcon :src="regenerateIcon" />
            </button>
            <button class="chat-md-bubble-options-button" type="button" :aria-label="t('chat.deleteFromHere')" @click="$emit('delete-from', message.mid || '')">
              <SvgIcon :src="deleteIcon" />
            </button>
            <RunDetails :run="message.meta?.run" />
          </div>
        </div>
      </article>
    </template>

    <article v-if="showDraft" :id="draftMessageId" class="chat-md-bubble-assistant" :class="{ 'is-error': runtime?.status === 'error' }">
      <div class="cmba-assistant-content">
        <div v-if="draftReasoning" class="cmba-reasoning-content">
          <details open>
            <summary>{{ t('tooltip.reasoning') }}</summary>
            <MarkdownBlock :content="draftReasoning" />
          </details>
        </div>
        <MarkdownBlock v-if="draftContent" :content="draftContent" />
        <div v-else class="chat-working" :aria-label="t('chat.runtimeRunning')"><span></span><span></span><span></span></div>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useAppStore } from "@/store";
import { getChatFileSource } from "@/persistence";
import { buildChatAttachmentDownloadFilename } from "@/services";
import { dsAlert, saveBlobToLocal, saveTextToLocal } from "@/utils";
import type { ChatMessageAttachment, ChatPromptMessage } from "@/types";
import MarkdownBlock from "@/components/MarkdownBlock.vue";
import RunDetails from "@/components/RunDetails.vue";
import SvgIcon from "@/components/SvgIcon.vue";
import copyIcon from "@/assets/svg/copy16.svg";
import deleteIcon from "@/assets/svg/delete16.svg";
import editIcon from "@/assets/svg/edit24.svg";
import regenerateIcon from "@/assets/svg/revert32.svg";
import saveIcon from "@/assets/svg/save18.svg";

const props = defineProps<{
  messages: ChatPromptMessage[];
  runtime?: Record<string, any> | null;
}>();

const emit = defineEmits<{
  edit: [payload: { mid: string; text: string }];
  regenerate: [mid: string];
  retry: [];
  "delete-from": [mid: string];
}>();

const store = useAppStore();
const { t } = useI18n();
const editingMid = ref("");
const editingText = ref("");
const editTextareaRef = ref<HTMLTextAreaElement | null>(null);

const draftMessageId = computed(() => String(props.runtime?.draftMessageId || "chat-draft"));
const draftContent = computed(() => String(props.runtime?.draftAssistantContent || ""));
const draftReasoning = computed(() => String(props.runtime?.draftReasoningContent || ""));
const showDraft = computed(() => Boolean(props.runtime?.pending));

function textContent(message: ChatPromptMessage) {
  return message.content.find((part) => part.type === "text")?.text || "";
}

function imageParts(message: ChatPromptMessage) {
  return message.content.filter((part) => part.type === "image_url");
}

function startEdit(message: ChatPromptMessage) {
  editingMid.value = message.mid || "";
  editingText.value = textContent(message);
  nextTick(() => {
    const textarea = Array.isArray(editTextareaRef.value) ? editTextareaRef.value[0] : editTextareaRef.value;
    textarea?.focus();
    textarea?.setSelectionRange(textarea.value.length, textarea.value.length);
  });
}

function cancelEdit() {
  editingMid.value = "";
  editingText.value = "";
}

function saveEdit(mid: string) {
  const text = editingText.value.trim();
  if (!mid || !text) return;
  emit("edit", { mid, text });
  cancelEdit();
}

function previewImage(url: string) {
  store.commit("setModalImage", url);
  (document.getElementById("global_image_preview_modal") as HTMLDialogElement | null)?.showModal();
}

function previewAttachment(attachment: ChatMessageAttachment) {
  store.commit("setModalChatAttachment", attachment);
  (document.getElementById("global_chat_file_preview_modal") as HTMLDialogElement | null)?.showModal();
}

async function downloadAttachment(attachment: ChatMessageAttachment) {
  const source = await getChatFileSource(attachment.id);
  const success = source
    ? await saveBlobToLocal(source, buildChatAttachmentDownloadFilename(attachment, true))
    : await saveTextToLocal(attachment.text, buildChatAttachmentDownloadFilename(attachment, false));
  if (!success) dsAlert({ type: "error", message: t("toast.fileDownloadFailed") });
}

async function copyMessage(message: ChatPromptMessage) {
  try {
    await navigator.clipboard.writeText(textContent(message));
    dsAlert({ type: "success", message: t("toast.messageCopySuccess") });
  } catch (error) {
    dsAlert({ type: "error", message: t("toast.messageCopyFailed", { error: String(error) }) });
  }
}
</script>

<style scoped lang="scss">
.chat-message-list { width: 100%; }
.cmbu-content-text { margin: 0; white-space: pre-wrap; }
.chat-message-edit-textarea {
  width: min(560px, 72vw);
  min-height: 112px;
  resize: vertical;
  border: 1px solid oklch(var(--bc) / 0.16);
  border-radius: 12px;
  padding: 10px 12px;
  background: oklch(var(--b1));
  color: oklch(var(--bc));
  font: inherit;
  line-height: 1.55;
  outline: none;
}
.chat-message-edit-textarea:focus { border-color: oklch(var(--p) / 0.55); box-shadow: 0 0 0 3px oklch(var(--p) / 0.08); }
.chat-message-edit-note { margin: 7px 2px 0; color: oklch(var(--bc) / 0.55); font-size: 12px; }
.chat-message-text-action {
  min-height: 30px;
  padding: 4px 10px;
  border: 1px solid oklch(var(--bc) / 0.12);
  border-radius: 9px;
  background: oklch(var(--b1));
  color: oklch(var(--bc) / 0.72);
  cursor: pointer;
}
.chat-message-text-action.is-primary { border-color: transparent; background: oklch(var(--p)); color: oklch(var(--pc)); }
.chat-message-text-action:disabled { opacity: 0.45; cursor: default; }
.chat-md-bubble-options-button { background: transparent; color: oklch(var(--bc) / 0.65); }
.chat-md-bubble-options-button :deep(.svg-icon) { width: 16px; height: 16px; }
.cmba-options :deep(.run-details) { flex-basis: 100%; }
.chat-working { display: flex; gap: 5px; padding: 14px 2px; }
.chat-working span { width: 7px; height: 7px; border-radius: 50%; background: oklch(var(--bc) / 0.4); animation: chat-working 1.1s ease-in-out infinite; }
.chat-working span:nth-child(2) { animation-delay: 0.14s; }
.chat-working span:nth-child(3) { animation-delay: 0.28s; }
@keyframes chat-working { 0%, 60%, 100% { transform: translateY(0); opacity: 0.45; } 30% { transform: translateY(-4px); opacity: 1; } }

@media (max-width: 640px) {
  .chat-message-edit-textarea { width: 100%; min-height: 96px; }
}
</style>
