<template>
  <div class="video-message-list">
    <article
      v-for="message in messages"
      :key="message.id"
      :id="message.id"
      class="video-message"
      :class="[`is-${message.role}`, `is-${getMessageStatus(message)}`]"
    >
      <div
        class="video-message-body"
        :class="{
          'is-collapsible': message.role === 'user' && collapsibleMessageIds.has(message.id),
          'is-expanded': message.role === 'user' && expandedUserMessageIds.has(message.id),
        }"
      >
        <template v-if="message.role === 'user'">
          <div class="video-message-content" :ref="(el) => registerMessageContent(message.id, el)">
            <p v-if="message.prompt" class="video-message-prompt">{{ message.prompt }}</p>

            <div v-if="message.attachments?.length" class="video-attachment-row">
              <button
                v-for="attachment in message.attachments"
                :key="attachment.id"
                class="video-attachment"
                :class="{ clickable: attachment.content_type?.startsWith('image/') }"
                type="button"
                :disabled="!attachment.content_type?.startsWith('image/')"
                @click="previewAttachmentImage(attachment.previewUrl)"
              >
                <img v-if="attachment.content_type?.startsWith('image/')" :src="attachment.previewUrl" :alt="attachment.filename" />
                <span v-else class="video-audio-badge">{{ attachment.filename }}</span>
              </button>
            </div>
          </div>

          <button
            v-if="collapsibleMessageIds.has(message.id)"
            class="video-message-toggle"
            :class="{ 'is-expanded': expandedUserMessageIds.has(message.id) }"
            type="button"
            :aria-label="expandedUserMessageIds.has(message.id) ? t('common.collapseMessage') : t('common.expandMessage')"
            :aria-expanded="expandedUserMessageIds.has(message.id)"
            @click="toggleMessage(message.id)"
          >
            <SvgIcon :src="arrowUpIcon" class="video-message-toggle-icon" />
          </button>
          <div class="video-message-actions">
            <button type="button" :disabled="reuseDisabled" @click="emit('reuse', message)">
              <SvgIcon :src="editIcon" />
              <span>{{ t("video.reuseInput") }}</span>
            </button>
          </div>
        </template>

        <template v-else>
          <div class="video-message-meta">
            <span v-if="message.run?.route.model">{{ message.run.route.model }}</span>
            <span v-if="message.run?.request.params.resolution">{{ message.run.request.params.resolution }}</span>
            <span v-if="getMessageElapsedMs(message) !== null">{{ formatElapsedMs(getMessageElapsedMs(message)!) }}</span>
          </div>

          <div v-if="message.run?.status === 'running'" class="video-loading-card">
            <div class="video-loading-preview"></div>
            <span>{{ loadingStatusText }}</span>
          </div>

          <div v-if="message.videos.length" class="video-output-grid">
            <figure v-for="video in message.videos" :key="video.id" class="video-output-card">
              <video :src="video.src" controls playsinline preload="metadata" />
            </figure>
          </div>

          <div v-if="message.run?.error" class="video-error-message">{{ message.run.error }}</div>
          <RunDetails :run="message.run" />
        </template>
      </div>
    </article>
  </div>
</template>

<script setup lang="ts">
import { onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useAppStore } from "@/store";
import RunDetails from "@/components/RunDetails.vue";
import SvgIcon from "@/components/SvgIcon.vue";
import arrowUpIcon from "@/assets/svg/arrowUp32.svg";
import editIcon from "@/assets/svg/edit24.svg";
import { useCreationMessageUi } from "@/services/creation";
import type { VideoConversationMessage } from "@/types";

const props = defineProps<{
  messages: VideoConversationMessage[];
  runtimeTick: number;
  loadingStatusText: string;
  reuseDisabled?: boolean;
}>();

const emit = defineEmits<{
  reuse: [message: VideoConversationMessage];
}>();

const store = useAppStore();
const { t } = useI18n();
const {
  collapsibleMessageIds,
  expandedMessageIds: expandedUserMessageIds,
  refreshMessageUi,
  registerMessageContent,
  toggleMessage,
} = useCreationMessageUi();

function previewAttachmentImage(src: string) {
  if (!src) return;
  store.commit("setModalImage", src);
  const dialog = document.getElementById("global_image_preview_modal") as HTMLDialogElement | null;
  dialog?.showModal();
}

function formatElapsedMs(elapsedMs: number) {
  return `${(elapsedMs / 1000).toFixed(1)}s`;
}

function getMessageStatus(message: VideoConversationMessage): "ready" | "loading" | "success" | "error" {
  if (!message.run) return "ready";
  if (message.run.status === "running") return "loading";
  return message.run.status === "success" ? "success" : "error";
}

function getMessageElapsedMs(message: VideoConversationMessage): number | null {
  if (message.run?.status === "running") {
    if (message.role !== "assistant") return null;
    const startedAt = Number(message.run.startedAt || message.createdAt || 0);
    return startedAt ? Math.max(0, props.runtimeTick - startedAt) : null;
  }
  return message.run && message.run.durationMs > 0 ? message.run.durationMs : null;
}

watch(
  () => props.messages.map((message) => `${message.id}:${message.role}:${message.prompt}:${message.attachments?.length || 0}`).join("|"),
  refreshMessageUi,
  { immediate: true },
);

onMounted(refreshMessageUi);
</script>

<style lang="scss" scoped>
.video-message-list { display: flex; flex-direction: column; gap: 22px; }
.video-message { display: flex; }
.video-message.is-user { justify-content: flex-end; }
.video-message.is-assistant { justify-content: flex-start; }
.video-message.is-user .video-message-body { max-width: min(560px, 82%); border-radius: 30px; background: #f1f1f0; }
.video-message.is-assistant .video-message-body { width: min(720px, 100%); border-radius: 8px; background: transparent; }
.video-message-body { min-width: 0; padding: 16px 18px; }
.video-message.is-user .video-message-body {
  position: relative;
  overflow: hidden;
  &.is-collapsible {
    padding-bottom: 12px;
    &::after {
      content: "";
      position: absolute;
      right: 0;
      bottom: 42px;
      left: 0;
      height: 52px;
      pointer-events: none;
      background: linear-gradient(180deg, rgba(241, 241, 240, 0), #f1f1f0 70%);
    }
  }
  &.is-expanded::after { display: none; }
}
.video-message-content {
  max-height: 200px;
  overflow: hidden;
  scrollbar-width: thin;
  scrollbar-color: oklch(var(--bc) / 0.28) transparent;
}
.video-message-body.is-expanded .video-message-content { overflow-y: auto; }
.video-message-toggle {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin: 8px 0 0 auto;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: oklch(var(--bc) / 0.76);
  cursor: pointer;
  :deep(.video-message-toggle-icon) { width: 16px; height: 16px; transform: rotate(180deg); }
  &.is-expanded :deep(.video-message-toggle-icon) { transform: rotate(0deg); }
}
.video-message-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
  button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 30px;
    padding: 4px 10px;
    border: 0;
    border-radius: 9px;
    background: transparent;
    color: oklch(var(--bc) / 0.64);
    font-size: 12px;
    cursor: pointer;
  }
  button:hover:not(:disabled) { background: oklch(var(--b1) / 0.75); color: oklch(var(--bc)); }
  button:disabled { cursor: not-allowed; opacity: 0.48; }
  :deep(.svg-icon) { width: 15px; height: 15px; }
}
.video-message-body > :deep(.run-details) { margin-top: 10px; }
.video-message-meta { display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px; }
.video-message-meta span {
  min-height: 24px;
  display: inline-flex;
  align-items: center;
  padding: 0 9px;
  border-radius: 999px;
  background: rgba(17, 24, 39, 0.05);
}
.video-message-prompt { margin: 4px 0 0; color: oklch(var(--bc)); line-height: 1.7; white-space: pre-wrap; }
.video-attachment-row, .video-output-grid { margin-top: 14px; }
.video-attachment-row { display: flex; flex-wrap: wrap; gap: 10px; }
.video-attachment {
  width: 96px;
  height: 96px;
  padding: 0;
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid rgba(17, 24, 39, 0.08);
  background: transparent;
  &.clickable { cursor: zoom-in; }
  img { width: 100%; height: 100%; object-fit: cover; }
}
.video-audio-badge { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 12px; color: oklch(var(--bc)); background: oklch(var(--b2)); }
.video-output-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
.video-output-card {
  margin: 0;
  overflow: hidden;
  border-radius: 8px;
  background: #000;
  video { display: block; width: 100%; max-height: 400px; }
}
.video-loading-card { width: min(360px, 100%); margin-top: 14px; color: oklch(var(--b1)); font-size: 13px; }
.video-loading-preview { width: 100%; aspect-ratio: 16 / 9; margin-bottom: 10px; border-radius: 8px; background: #e5e7eb; }
.video-error-message { margin-top: 12px; padding: 12px 14px; border-radius: 8px; background: #fef2f2; color: #b91c1c; line-height: 1.6; }
</style>
