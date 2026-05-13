<template>
  <div class="settings-section">
    <div class="section-header">
      <div>
        <h2>{{ t(titleKey) }}</h2>
        <p>{{ t(descriptionKey) }}</p>
      </div>
      <div class="section-actions">
        <button class="btn btn-neutral" @click="addImageModel">
          {{ t("user.imageModels.add") }}
        </button>
        <button class="btn btn-outline" :disabled="selectedIndex === -1" @click="duplicateImageModel">
          {{ t("user.imageModels.duplicate") }}
        </button>
      </div>
    </div>

    <div class="settings-workspace">
      <aside class="settings-list-panel">
        <button
          v-for="(imageModel, index) in props.models"
          :key="`${imageModel.name}-${index}`"
          class="settings-list-item"
          :class="{ active: index === selectedIndex }"
          @click="selectIndex(index)"
        >
          <div class="settings-list-title-row">
            <div class="settings-list-title">{{ imageModel.name || t("common.unnamedModel") }}</div>
            <span class="provider-chip">{{ modelProviderLabel(imageModel) }}</span>
          </div>
          <div class="settings-list-meta">
            <span>{{ getImageModelLocation(imageModel) || t("user.modelCard.fields.imageUrl") }}</span>
          </div>
          <div class="settings-list-badges">
            <span :class="{ active: supportsImageInput(imageModel) }">{{
              supportsImageInput(imageModel) ? t("user.imageModels.inputImageBadge") : t("user.imageModels.textOnlyBadge")
            }}</span>
          </div>
        </button>
        <div v-if="props.models.length === 0" class="settings-empty-list">
          {{ t("user.imageModels.emptyList") }}
        </div>
      </aside>

      <section class="settings-detail-panel">
        <template v-if="currentModel">
          <div class="detail-toolbar">
            <div>
              <h3>{{ currentModel.name || t("common.unnamedModel") }}</h3>
              <p>{{ detailSummary }}</p>
            </div>
            <button class="btn btn-outline btn-error" @click="deleteImageModel">
              {{ t("user.imageModels.delete") }}
            </button>
          </div>

          <ModelEditCard
            :model="currentModel"
            :model-suggestions="imageModelTypeList"
            model-kind="image"
            :image-operation="modelOperation"
            @update:model="updateCurrentModel"
          />
        </template>

        <div v-else class="settings-empty-detail">
          {{ t("user.imageModels.emptyDetail") }}
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { getModelImageParamDefs, imageModelTypeList, isAzureImageModel } from "@/constants";
import { append4Random } from "@/utils";
import ModelEditCard from "@/views/setting/components/ModelEditCard.vue";
import type { ImageModelConfig, ImageOperation, ModelConfig } from "@/types/model";

const props = withDefaults(
  defineProps<{
    models?: ImageModelConfig[];
    titleKey?: string;
    descriptionKey?: string;
    modelOperation?: ImageOperation;
  }>(),
  {
    models: () => [],
    titleKey: "user.imageModels.title",
    descriptionKey: "user.imageModels.description",
    modelOperation: "generation",
  },
);

const emit = defineEmits<{ "update:models": [models: ImageModelConfig[]] }>();
const { t } = useI18n();
const selectedIndex = ref(-1);

const cloneModel = (model: ImageModelConfig): ImageModelConfig => JSON.parse(JSON.stringify(model));

const currentModel = computed(() => {
  if (selectedIndex.value < 0 || selectedIndex.value >= props.models.length) return null;
  return props.models[selectedIndex.value];
});
const detailSummary = computed(() => {
  if (!currentModel.value) return "";
  const modelId = currentModel.value.model || t("common.unsetModelId");
  const endpointLabel = isAzureImageModel(currentModel.value) ? currentModel.value.endpoint : ("baseURL" in currentModel.value ? currentModel.value.baseURL : "");
  return `${modelProviderLabel(currentModel.value)} · ${endpointLabel || modelId}`;
});

const modelProviderLabel = (model: ImageModelConfig) => model?.provider || "OpenAI";

const getImageModelLocation = (model: ImageModelConfig) => (isAzureImageModel(model) ? model.endpoint : ("baseURL" in model ? model.baseURL : ""));

const supportsImageInput = (model: ImageModelConfig) => {
  return getModelImageParamDefs(model).some((item) => item.type === "image");
};

const selectIndex = (index: number) => {
  selectedIndex.value = index;
};

const updateModels = (nextModels: ImageModelConfig[]) => {
  emit("update:models", nextModels);
};

const updateCurrentModel = (nextModel: ModelConfig) => {
  if (selectedIndex.value < 0) return;
  const updatedModel = nextModel as ImageModelConfig;
  if (JSON.stringify(props.models[selectedIndex.value]) === JSON.stringify(updatedModel)) return;
  const nextModels = props.models.map((item, index) => (index === selectedIndex.value ? updatedModel : item));
  updateModels(nextModels);
};

const addImageModel = () => {
  const nextModel: ImageModelConfig = {
    name: append4Random(t("user.imageModels.defaultName")),
    provider: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    apiKey: "",
    model: "",
    imageOperation: props.modelOperation,
  };

  const nextModels = [...props.models, nextModel];
  updateModels(nextModels);
  selectedIndex.value = nextModels.length - 1;
};

const duplicateImageModel = () => {
  if (!currentModel.value) return;
  const duplicated = cloneModel(currentModel.value);
  duplicated.name = `${duplicated.name || t("user.imageModels.defaultName")}-${t("common.duplicateSuffix")}`;
  const nextModels = [...props.models, duplicated];
  updateModels(nextModels);
  selectedIndex.value = nextModels.length - 1;
};

const deleteImageModel = () => {
  if (selectedIndex.value < 0) return;
  const nextModels = props.models.filter((_, index) => index !== selectedIndex.value);
  updateModels(nextModels);
  if (nextModels.length === 0) {
    selectedIndex.value = -1;
  } else if (selectedIndex.value >= nextModels.length) {
    selectedIndex.value = nextModels.length - 1;
  }
};

watch(
  () => props.models.length,
  (newLength) => {
    if (newLength === 0) {
      selectedIndex.value = -1;
      return;
    }

    if (selectedIndex.value === -1) {
      selectedIndex.value = 0;
      return;
    }

    if (selectedIndex.value >= newLength) {
      selectedIndex.value = newLength - 1;
    }
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
  border: 1px solid oklch(var(--bc) / 0.08);
  background: oklch(var(--b2) / 0.8);
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
    background: oklch(var(--bc) / 0.055);
    color: oklch(var(--bc) / 0.62);
    font-size: 10px;
    font-weight: 700;

    &.active {
      background: oklch(var(--su) / 0.12);
      color: oklch(var(--su) / 0.78);
    }
  }
}
</style>
