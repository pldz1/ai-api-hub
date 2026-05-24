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
            <span :class="{ active: supportsImageInput(model as ImageModelConfig) }">
              {{ supportsImageInput(model as ImageModelConfig) ? t("user.imageModels.inputImageBadge") : t("user.imageModels.textOnlyBadge") }}
            </span>
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

          <ModelEditor
            :model="currentModel"
            :model-suggestions="modelSuggestions"
            :kind="kind"
            :operation="operation"
            @update:model="updateCurrentModel"
          />
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
import { getModelImageParamDefs, isAzureImageModel } from "@/models";
import { append4Random } from "@/utils";
import type { ChatModelConfig, ImageModelConfig, ImageOperation, ModelConfig, ModelKind } from "@/types";

const props = withDefaults(
  defineProps<{
    models?: (ChatModelConfig | ImageModelConfig)[];
    kind?: ModelKind;
    operation?: ImageOperation;
    titleKey?: string;
    descriptionKey?: string;
  }>(),
  {
    models: () => [],
    kind: "chat",
    operation: "generation",
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
  const endpointLabel = isAzureImageModel(model) ? model.endpoint : "baseURL" in model ? model.baseURL : "";
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
        imageOperation: props.operation,
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
  if (!currentModel.value) return;
  const duplicated = structuredClone(currentModel.value);
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
  return (isAzureImageModel(imageModel) ? imageModel.endpoint : "baseURL" in imageModel ? imageModel.baseURL : "") || t("user.modelCard.fields.imageUrl");
}

function supportsImageInput(model: ImageModelConfig) {
  // 🖼️ Badge image models that can accept image input parameters.
  return getModelImageParamDefs(model).some((item) => item.type === "image");
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
  border: 1px solid rgba(17, 24, 39, 0.06);
  background: rgba(255, 255, 255, 0.86);
  color: #5f6368;
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
    background: #f7f7f6;
    color: #6b7280;
    font-size: 10px;
    font-weight: 700;
    border: 1px solid rgba(17, 24, 39, 0.04);

    &.active {
      background: #eef6ff;
      color: #174466;
      border-color: rgba(35, 95, 143, 0.12);
    }
  }
}
</style>
