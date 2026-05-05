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
            <span class="api-chip">{{ modelApiLabel(imageModel) }}</span>
          </div>
          <div class="settings-list-meta">
            <span>{{ imageModel.baseURL || t("user.modelCard.fields.imageUrl") }}</span>
          </div>
          <div class="settings-list-badges">
            <span>{{ modelParamCount(imageModel) }} {{ t("user.imageModels.paramsBadge") }}</span>
            <span :class="{ active: supportsImageInput(imageModel) }">{{ supportsImageInput(imageModel) ? t("user.imageModels.inputImageBadge") : t("user.imageModels.textOnlyBadge") }}</span>
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

          <ModelEditCard :model="currentModel" :model-suggestions="imageModelTypeList" model-kind="image" :image-operation="modelOperation" @update:model="updateCurrentModel" />
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
import { defModelType, imageModelTypeList, normalizeImageModelConfig } from "@/constants";
import { append4Random } from "@/utils";
import ModelEditCard from "@/components/ModelEditCard.vue";
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
  const modelId = currentModel.value.modelType || currentModel.value.model || t("common.unsetModelId");
  return `${modelApiLabel(currentModel.value)} · ${currentModel.value.baseURL || modelId}`;
});

const modelApiLabel = (model: ImageModelConfig) => model?.apiType || "OpenAI";

const modelParamCount = (model: ImageModelConfig) => (Array.isArray(model?.imageParamDefs) ? model.imageParamDefs.length : 0);

const supportsImageInput = (model: ImageModelConfig) => {
  return Array.isArray(model?.imageParamDefs) && model.imageParamDefs.some((item) => item.type === "image");
};

const selectIndex = (index: number) => {
  selectedIndex.value = index;
};

const updateModels = (nextModels: ImageModelConfig[]) => {
  emit("update:models", nextModels);
};

const updateCurrentModel = (nextModel: ModelConfig) => {
  if (selectedIndex.value < 0) return;
  const normalizedModel = normalizeImageModelConfig(nextModel, props.modelOperation);
  if (JSON.stringify(props.models[selectedIndex.value]) === JSON.stringify(normalizedModel)) return;
  const nextModels = props.models.map((item, index) => (index === selectedIndex.value ? normalizedModel : item));
  updateModels(nextModels);
};

const addImageModel = () => {
  const nextModel = normalizeImageModelConfig(
    {
      ...defModelType,
      name: append4Random("图像模型"),
      apiType: "OpenAI",
      baseURL: "https://api.openai.com/v1",
      modelType: "",
      model: "",
    },
    props.modelOperation,
  );

  const nextModels = [...props.models, nextModel];
  updateModels(nextModels);
  selectedIndex.value = nextModels.length - 1;
};

const duplicateImageModel = () => {
  if (!currentModel.value) return;
  const duplicated = cloneModel(currentModel.value);
  duplicated.name = `${duplicated.name || "图像模型"}-copy`;
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
.settings-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  min-height: 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;

  h2 {
    font-size: 20px;
    line-height: 1.1;
    font-weight: 700;
  }

  p {
    margin-top: 4px;
    color: oklch(var(--bc) / 0.65);
    font-size: 12px;
  }
}

.section-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;

  .btn {
    min-height: 42px;
  }
}

.settings-workspace {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 16px;
  min-height: 0;
  flex: 1;
  overflow: hidden;
}

.settings-list-panel,
.settings-detail-panel {
  min-height: 0;
  border: 1px solid oklch(var(--b3) / 0.6);
  border-radius: 24px;
  background: linear-gradient(180deg, oklch(var(--b1)) 0%, oklch(var(--b2) / 0.75) 100%);
  box-shadow: inset 0 1px 0 oklch(var(--b1) / 0.9);
}

.settings-list-panel {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}

.settings-list-item {
  border: 1px solid oklch(var(--b3) / 0.45);
  border-radius: 18px;
  padding: 14px;
  text-align: left;
  background-color: oklch(var(--b1) / 0.8);
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    border-color: oklch(var(--n) / 0.14);
    transform: translateY(-1px);
    box-shadow: 0 12px 24px oklch(var(--n) / 0.05);
  }

  &.active {
    border-color: oklch(var(--su) / 0.22);
    background: linear-gradient(180deg, oklch(var(--b1)) 0%, oklch(var(--su) / 0.07) 100%);
    box-shadow: 0 14px 28px oklch(var(--n) / 0.06);
  }
}

.settings-list-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.settings-list-title {
  min-width: 0;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.api-chip {
  flex: 0 0 auto;
  border-radius: 999px;
  padding: 3px 8px;
  border: 1px solid oklch(var(--bc) / 0.08);
  background: oklch(var(--b2) / 0.8);
  color: oklch(var(--bc) / 0.68);
  font-size: 10px;
  font-weight: 700;

  &.azure {
    border-color: oklch(var(--p) / 0.18);
    background: oklch(var(--p) / 0.08);
    color: oklch(var(--p) / 0.82);
  }
}

.settings-list-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
  font-size: 11px;
  color: oklch(var(--bc) / 0.65);

  span {
    display: -webkit-box;
    max-width: 100%;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    overflow: hidden;
    text-overflow: ellipsis;
    word-break: break-word;
  }
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

.settings-empty-list,
.settings-empty-detail {
  border: 1px dashed oklch(var(--b3));
  border-radius: 18px;
  padding: 20px;
  color: oklch(var(--bc) / 0.62);
  font-size: 14px;
}

.settings-detail-panel {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}

.detail-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;

  h3 {
    font-size: 18px;
    font-weight: 700;
  }

  p {
    margin-top: 4px;
    font-size: 12px;
    color: oklch(var(--bc) / 0.65);
  }
}

@media (max-width: 1100px) {
  .settings-workspace {
    grid-template-columns: 1fr;
  }
}
</style>
