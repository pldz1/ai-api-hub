<template>
  <div class="settings-section">
    <!-- Model panel header and list actions -->
    <div class="section-header">
      <div>
        <h2>{{ t(resolvedTitleKey) }}</h2>
        <p>{{ t(resolvedDescriptionKey) }}</p>
      </div>
      <div class="section-actions">
        <button class="btn btn-neutral" @click="addModel">{{ t(isImageKind ? "user.imageModels.add" : "user.chatModels.add") }}</button>
        <button class="btn btn-outline" :disabled="selectedIndex === -1" @click="duplicateModel">
          {{ t(isImageKind ? "user.imageModels.duplicate" : "user.chatModels.duplicate") }}
        </button>
        <button v-if="!isImageKind" class="btn btn-outline btn-error" :disabled="selectedIndex === -1" @click="deleteModel">
          {{ t("user.chatModels.delete") }}
        </button>
      </div>
    </div>

    <div class="settings-workspace">
      <!-- Configured models list -->
      <aside class="settings-list-panel">
        <button
          v-for="(model, index) in models"
          :key="`${model.name}-${index}`"
          class="settings-list-item"
          :class="{ active: index === selectedIndex }"
          @click="selectedIndex = index"
        >
          <div class="settings-list-title-row">
            <div class="settings-list-title">{{ model.name || t("common.unnamedModel") }}</div>
            <span v-if="isImageKind" class="provider-chip">{{ model.provider || "OpenAI" }}</span>
          </div>
          <div class="settings-list-meta">
            <span v-if="!isImageKind">{{ model.provider || t("common.unsetProvider") }}</span>
            <span>{{ modelListMeta(model) }}</span>
          </div>
          <div v-if="isImageKind" class="settings-list-badges">
            <span class="active">Generation</span>
            <span class="active">Edit</span>
          </div>
        </button>
        <div v-if="models.length === 0" class="settings-empty-list">
          {{ t(isImageKind ? "user.imageModels.emptyList" : "user.chatModels.emptyList") }}
        </div>
      </aside>

      <!-- Selected model details and editor -->
      <section class="settings-detail-panel">
        <template v-if="currentModel">
          <div class="detail-toolbar">
            <div>
              <h3>{{ currentModel.name || t("common.unnamedModel") }}</h3>
              <p>{{ detailSummary }}</p>
            </div>
            <button v-if="isImageKind" class="btn btn-outline btn-error" @click="deleteModel">
              {{ t("user.imageModels.delete") }}
            </button>
          </div>

          <ModelEditor :model="currentModel" :model-suggestions="modelSuggestions" :kind="kind" @update:model="updateCurrentModel" />
        </template>

        <div v-else class="settings-empty-detail">
          {{ t(isImageKind ? "user.imageModels.emptyDetail" : "user.chatModels.emptyDetail") }}
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import ModelEditor from "./ModelEditor.vue";
import { chatModelTypeList, imageModelTypeList } from "@/constants";
import { append4Random } from "@/utils";
import type { ChatModelConfig, ImageModelConfig, ModelConfig, ModelKind } from "@/types";

const props = withDefaults(
  defineProps<{
    models?: (ChatModelConfig | ImageModelConfig)[];
    kind?: ModelKind;
    titleKey?: string;
    descriptionKey?: string;
  }>(),
  {
    models: () => [],
    kind: "chat",
    titleKey: "",
    descriptionKey: "",
  },
);
const emit = defineEmits<{ "update:models": [models: (ChatModelConfig | ImageModelConfig)[]] }>();
const { t } = useI18n();
const selectedIndex = ref(-1);

const isImageKind = computed(() => props.kind === "image");
const resolvedTitleKey = computed(() => props.titleKey || (isImageKind.value ? "user.imageModels.title" : "user.chatModels.title"));
const resolvedDescriptionKey = computed(() => props.descriptionKey || (isImageKind.value ? "user.imageModels.description" : "user.chatModels.description"));
const modelSuggestions = computed(() => (isImageKind.value ? imageModelTypeList : chatModelTypeList));
const currentModel = computed(() => {
  // Guard selection because parent updates can shrink or replace the model array.
  if (selectedIndex.value < 0 || selectedIndex.value >= props.models.length) return null;
  return props.models[selectedIndex.value];
});
const detailSummary = computed(() => {
  // Show the most useful routing detail for the currently selected model.
  if (!currentModel.value) return "";
  if (!isImageKind.value) return currentModel.value.provider || t("user.chatModels.providerHint");
  const model = currentModel.value as ImageModelConfig;
  const modelId = model.model || t("common.unsetModelId");
  const endpointLabel = model.baseURL || "";
  return `${model.provider || "OpenAI"} · ${endpointLabel || modelId}`;
});

function updateModels(nextModels: (ChatModelConfig | ImageModelConfig)[]) {
  emit("update:models", nextModels);
}

function addModel() {
  // Seed new models with provider defaults so the editor starts from a usable shape.
  const nextModel = isImageKind.value
    ? ({
        name: append4Random(t("user.imageModels.defaultName")),
        provider: "OpenAI",
        baseURL: "https://api.openai.com/v1",
        apiKey: "",
        model: "",
      } as ImageModelConfig)
    : ({
        name: append4Random(t("user.chatModels.defaultName")),
        provider: "OpenAI",
        baseURL: "https://api.openai.com/v1",
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

function modelListMeta(model: ChatModelConfig | ImageModelConfig) {
  // Image models are identified by endpoint/base URL, while chat models use model IDs.
  if (!isImageKind.value) return model.model || t("common.unsetModelId");
  const imageModel = model as ImageModelConfig;
  return imageModel.baseURL || t("user.modelCard.fields.imageUrl");
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
.settings-list-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.provider-chip {
  flex: 0 0 auto;
  border-radius: 999px;
  padding: 3px 8px;
  border: 1px solid oklch(var(--bc) / 0.06);
  background: oklch(var(--b1) / 0.86);
  color: oklch(var(--bc) / 0.68);
  font-size: 10px;
  font-weight: 700;
}

.settings-list-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;

  span {
    border-radius: 999px;
    padding: 4px 8px;
    background: oklch(var(--b2));
    color: oklch(var(--bc) / 0.62);
    font-size: 10px;
    font-weight: 700;
    border: 1px solid oklch(var(--bc) / 0.04);

    &.active {
      background: oklch(var(--p) / 0.12);
      color: oklch(var(--p));
      border-color: oklch(var(--p) / 0.14);
    }
  }
}

@media (max-width: 720px) {
  .section-header {
    .section-actions {
      width: 100%;
      display: grid;
      grid-template-columns: 1fr;
      gap: 10px;

      .btn {
        width: 100%;
      }
    }
  }

  .settings-workspace {
    gap: 18px;
  }

  .settings-list-panel,
  .settings-detail-panel {
    border-radius: 22px;
  }

  .settings-list-panel {
    max-height: none;
    padding: 12px;
  }

  .settings-list-item {
    padding: 16px;
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

  .settings-detail-panel {
    padding: 16px;
  }

  .detail-toolbar {
    gap: 12px;

    .btn {
      width: 100%;
    }
  }
}
</style>
