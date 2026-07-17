<template>
  <div class="settings-section">
    <div class="settings-workspace model-settings-workspace">
      <!-- Configured models list -->
      <aside class="settings-list-panel model-list-panel" :class="{ empty: models.length === 0 }">
        <div class="model-list-rail">
          <button
            v-for="(model, index) in models"
            :key="`${model.name}-${index}`"
            class="settings-list-item"
            :class="{ active: index === selectedIndex }"
            @click="selectedIndex = index"
          >
            <div class="settings-list-title-row">
              <div class="settings-list-title">{{ model.name || t("common.unnamedModel") }}</div>
              <span class="provider-chip">{{ getModelProviderLabel(model) }}</span>
            </div>
            <div class="settings-list-meta">
              <span>{{ modelListMeta(model) }}</span>
            </div>
          </button>
        </div>
        <div v-if="models.length === 0" class="settings-empty-list">
          {{ t(isVideoKind ? "user.videoModels.emptyList" : isImageKind ? "user.imageModels.emptyList" : "user.chatModels.emptyList") }}
        </div>
      </aside>

      <!-- Selected model details and editor -->
      <section class="settings-detail-content">
        <div v-if="isChatKind" class="chat-endpoint-notice">
          <span>{{ t("user.chatModels.endpointNotice") }}</span>
          <RouterLink class="chat-endpoint-link" to="/qa">{{ t("user.chatModels.endpointNoticeLink") }}</RouterLink>
        </div>
        <div v-if="isVideoKind" class="video-proxy-notice">
          {{ t("user.videoModels.proxyNotice") }}
        </div>
        <div class="model-list-actions">
          <button class="model-list-action is-primary" type="button" @click="addModel">
            <SvgIcon class="model-list-action-icon" :src="newIcon" />
            <span>{{ t(modelKindKey("add")) }}</span>
          </button>
          <button class="model-list-action" type="button" :disabled="!currentModel" @click="duplicateModel">
            <SvgIcon class="model-list-action-icon" :src="copyIcon" />
            <span>{{ t(modelKindKey("duplicate")) }}</span>
          </button>
          <button class="model-list-action is-danger" type="button" :disabled="!currentModel" @click="deleteModel">
            <SvgIcon class="model-list-action-icon" :src="deleteIcon" />
            <span>{{ t(modelKindKey("delete")) }}</span>
          </button>
        </div>

        <template v-if="currentModel">
          <ModelEditor :model="currentModel" :kind="kind" @update:model="updateCurrentModel" />
        </template>

        <div v-else class="settings-empty-detail">
          {{ t(modelKindKey("emptyDetail")) }}
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { useI18n } from "vue-i18n";
import ModelEditor from "./ModelEditor.vue";
import copyIcon from "@/assets/svg/copy16.svg";
import deleteIcon from "@/assets/svg/delete16.svg";
import newIcon from "@/assets/svg/new24.svg";
import SvgIcon from "@/components/SvgIcon.vue";
import { getChatProviderDefaultBaseURL, getImageProviderDefaultBaseURL, getVideoProviderDefaultBaseURL } from "@/models";
import { append4Random } from "@/utils";
import type { ChatModelConfig, ImageModelConfig, VideoModelConfig, ModelConfig, ModelKind } from "@/types";

const props = withDefaults(
  defineProps<{
    models?: (ChatModelConfig | ImageModelConfig | VideoModelConfig)[];
    kind?: ModelKind;
  }>(),
  {
    models: () => [],
    kind: "chat",
  },
);
const emit = defineEmits<{
  "update:models": [models: (ChatModelConfig | ImageModelConfig | VideoModelConfig)[]];
}>();
const { t } = useI18n();
const selectedIndex = ref(-1);

const isChatKind = computed(() => props.kind === "chat");
const isImageKind = computed(() => props.kind === "image");
const isVideoKind = computed(() => props.kind === "video");
const currentModel = computed(() => {
  // Guard selection because parent updates can shrink or replace the model array.
  if (selectedIndex.value < 0 || selectedIndex.value >= props.models.length) return null;
  return props.models[selectedIndex.value];
});

function updateModels(nextModels: (ChatModelConfig | ImageModelConfig | VideoModelConfig)[]) {
  emit("update:models", nextModels);
}

function addModel() {
  // Seed new models with provider defaults so the editor starts from a usable shape.
  const nextModel = isVideoKind.value
    ? ({
        name: append4Random(t("user.videoModels.defaultName")),
        provider: "DashScope",
        baseURL: getVideoProviderDefaultBaseURL("DashScope"),
        apiKey: "",
        model: "wan2.7-i2v-2026-04-25",
      } as VideoModelConfig)
    : isImageKind.value
      ? ({
          name: append4Random(t("user.imageModels.defaultName")),
          provider: "OpenAI",
          baseURL: getImageProviderDefaultBaseURL("OpenAI"),
          apiKey: "",
          model: "gpt-image-2",
        } as ImageModelConfig)
      : ({
          name: append4Random(t("user.chatModels.defaultName")),
          provider: "OpenAI",
          baseURL: getChatProviderDefaultBaseURL("OpenAI"),
          apiKey: "",
          model: "gpt-5.5",
        } as ChatModelConfig);
  const nextModels = [...props.models, nextModel];
  updateModels(nextModels);
  selectedIndex.value = nextModels.length - 1;
}

function duplicateModel() {
  if (!currentModel.value) {
    console.warn("No model selected to duplicate.");
    return;
  }
  const duplicated = JSON.parse(JSON.stringify(currentModel.value));
  duplicated.name = `${duplicated.name || t(isImageKind.value ? "user.imageModels.defaultName" : "user.chatModels.defaultName")}-${t("common.duplicateSuffix")}`;
  const nextModels = [...props.models, duplicated];
  updateModels(nextModels);
  selectedIndex.value = nextModels.length - 1;
}

function deleteModel() {
  if (selectedIndex.value < 0) return;
  const nextModels = props.models.filter((_, index) => index !== selectedIndex.value);
  updateModels(nextModels);
  selectedIndex.value = Math.min(selectedIndex.value, nextModels.length - 1);
}

function updateCurrentModel(nextModel: ModelConfig) {
  if (selectedIndex.value < 0) return;
  updateModels(props.models.map((item, index) => (index === selectedIndex.value ? nextModel : item)));
}

function modelKindKey(action: string): string {
  if (isVideoKind.value) return `user.videoModels.${action}`;
  if (isImageKind.value) return `user.imageModels.${action}`;
  return `user.chatModels.${action}`;
}

function getModelProviderLabel(model: ChatModelConfig | ImageModelConfig | VideoModelConfig) {
  return model.provider || t("common.unsetProvider");
}

function modelListMeta(model: ChatModelConfig | ImageModelConfig | VideoModelConfig) {
  return model.model || t("common.unsetModelId");
}

watch(
  () => props.models.length,
  (length) => {
    // Keep selection stable when models are added, deleted, or imported.
    selectedIndex.value = length === 0 ? -1 : Math.min(Math.max(selectedIndex.value, 0), length - 1);
  },
  { immediate: true },
);
</script>

<style lang="scss" scoped>
.settings-workspace.model-settings-workspace {
  width: min(100%, 1064px);
  margin-inline: auto;
  display: grid;
  grid-template-columns: minmax(220px, 260px) minmax(0, 1fr);
  gap: 22px;
  min-height: 0;
  flex: 1 1 auto;
  overflow: hidden;
}

.settings-list-panel.model-list-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  padding: 10px;
  overflow: hidden;
  border-radius: 14px;
  background: oklch(var(--b1));
  box-shadow: none;

  &.empty {
    overflow: hidden;
  }
}

.model-list-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(112px, max-content));
  gap: 6px;
  flex: 0 0 auto;
  justify-content: flex-end;
}

.model-list-action {
  min-width: 0;
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 8px;
  border: 1px solid oklch(var(--bc) / 0.1);
  border-radius: 8px;
  background: oklch(var(--b1));
  color: oklch(var(--bc) / 0.76);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;

  span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &:hover:not(:disabled) {
    border-color: oklch(var(--bc) / 0.18);
    background: oklch(var(--b2) / 0.5);
    color: oklch(var(--bc));
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  &.is-primary {
    border-color: oklch(var(--p) / 0.28);
    background: oklch(var(--p) / 0.1);
    color: oklch(var(--p));

    &:hover {
      border-color: oklch(var(--p) / 0.42);
      background: oklch(var(--p) / 0.14);
    }
  }

  &.is-danger {
    color: oklch(var(--er));

    &:hover:not(:disabled) {
      border-color: oklch(var(--er) / 0.28);
      background: oklch(var(--er) / 0.1);
    }
  }
}

.model-list-action-icon {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
}

.model-list-rail {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 8px;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  scrollbar-gutter: stable;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-thumb {
    border: 2px solid transparent;
    border-radius: 8px;
    background: oklch(var(--bc) / 0.18);
    background-clip: content-box;
  }

  &::-webkit-scrollbar-track {
    margin-block: 6px;
    background: transparent;
  }
}

.settings-list-panel.model-list-panel .settings-list-item {
  width: 100%;
  flex: 0 0 auto;
  min-height: 76px;
  padding: 12px 13px;
  border-radius: 10px;
  box-shadow: none;
  transition: none;

  &:hover {
    border-color: oklch(var(--bc) / 0.12);
    box-shadow: none;
  }

  &.active {
    border-color: oklch(var(--p) / 0.28);
    background: oklch(var(--p) / 0.1);
    box-shadow: none;
  }
}

.settings-list-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.provider-chip {
  flex: 0 0 auto;
  max-width: 42%;
  border-radius: 8px;
  padding: 3px 8px;
  border: 1px solid oklch(var(--bc) / 0.06);
  background: oklch(var(--b2) / 0.5);
  color: oklch(var(--bc) / 0.68);
  font-size: 10px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.video-proxy-notice {
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid oklch(var(--er) / 0.28);
  background: oklch(var(--er) / 0.08);
  color: oklch(var(--er));
  font-size: 12px;
  line-height: 1.6;
  margin-bottom: 12px;
}

.chat-endpoint-notice {
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid oklch(var(--wa) / 0.32);
  background: oklch(var(--wa) / 0.1);
  color: oklch(var(--bc) / 0.78);
  font-size: 12px;
  line-height: 1.6;
  margin-bottom: 12px;
}

.chat-endpoint-link {
  margin-left: 8px;
  color: oklch(var(--p));
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 2px;
}

@media (max-width: 900px) {
  .settings-workspace.model-settings-workspace {
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: 16px;
    flex: 0 0 auto;
    overflow: visible;
  }

  .settings-list-panel.model-list-panel {
    border-radius: 14px;
    max-height: min(42vh, 286px);
    padding: 8px;
    overflow: hidden;
  }

  .model-list-rail {
    padding-right: 8px;
    overflow-y: auto;
  }

  .settings-list-panel.model-list-panel .settings-list-item {
    width: 100%;
    flex: 0 0 auto;
    min-height: 76px;
  }

  .settings-list-title-row {
    gap: 8px;
  }

  .provider-chip {
    font-size: 9px;
    padding: 2px 7px;
  }

  .settings-list-meta {
    margin-top: 6px;
  }
}

@media (max-width: 480px) {
  .model-list-actions {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .model-list-action {
    padding-inline: 6px;
    font-size: 11px;
  }
}
</style>
