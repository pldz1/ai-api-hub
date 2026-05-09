<template>
  <div class="settings-section">
    <div class="section-header">
      <div>
        <h2>{{ t("user.chatModels.title") }}</h2>
        <p>{{ t("user.chatModels.description") }}</p>
      </div>
      <div class="section-actions">
        <button class="btn btn-neutral" @click="addChatModel">
          {{ t("user.chatModels.add") }}
        </button>
        <button class="btn btn-outline" :disabled="selectedIndex === -1" @click="duplicateChatModel">
          {{ t("user.chatModels.duplicate") }}
        </button>
      </div>
    </div>

    <div class="settings-workspace">
      <aside class="settings-list-panel">
        <button
          v-for="(chatModel, index) in props.models"
          :key="`${chatModel.name}-${index}`"
          class="settings-list-item"
          :class="{ active: index === selectedIndex }"
          @click="selectIndex(index)"
        >
          <div class="settings-list-title">{{ chatModel.name || t("common.unnamedModel") }}</div>
          <div class="settings-list-meta">
            <span>{{ chatModel.provider || t("common.unsetProvider") }}</span>
            <span>{{ chatModel.modelType || t("common.unsetModelId") }}</span>
          </div>
        </button>
        <div v-if="props.models.length === 0" class="settings-empty-list">
          {{ t("user.chatModels.emptyList") }}
        </div>
      </aside>

      <section class="settings-detail-panel">
        <template v-if="currentModel">
          <div class="detail-toolbar">
            <div>
              <h3>{{ currentModel.name || t("common.unnamedModel") }}</h3>
              <p>{{ currentModel.provider || t("user.chatModels.providerHint") }}</p>
            </div>
            <button class="btn btn-outline btn-error" @click="deleteChatModel">
              {{ t("user.chatModels.delete") }}
            </button>
          </div>

          <ModelEditCard :model="currentModel" :model-suggestions="chatModelTypeList" model-kind="chat" @update:model="updateCurrentModel" />
        </template>

        <div v-else class="settings-empty-detail">
          {{ t("user.chatModels.emptyDetail") }}
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { defaultModelFormDraft, chatModelTypeList, normalizeChatModelConfig } from "@/constants";
import { append4Random } from "@/utils";
import ModelEditCard from "@/views/setting/components/ModelEditCard.vue";
import type { ChatModelConfig, ModelConfig } from "@/types/model";

const props = withDefaults(defineProps<{ models?: ChatModelConfig[] }>(), {
  models: () => [],
});

const emit = defineEmits<{ "update:models": [models: ChatModelConfig[]] }>();
const { t } = useI18n();
const selectedIndex = ref(-1);

const cloneModel = (model: ChatModelConfig): ChatModelConfig => JSON.parse(JSON.stringify(model));

const currentModel = computed(() => {
  if (selectedIndex.value < 0 || selectedIndex.value >= props.models.length) return null;
  return props.models[selectedIndex.value];
});

const selectIndex = (index: number) => {
  selectedIndex.value = index;
};

const updateModels = (nextModels: ChatModelConfig[]) => {
  emit("update:models", nextModels);
};

const updateCurrentModel = (nextModel: ModelConfig) => {
  if (selectedIndex.value < 0) return;
  const normalizedModel = normalizeChatModelConfig(nextModel);
  if (JSON.stringify(props.models[selectedIndex.value]) === JSON.stringify(normalizedModel)) return;
  const nextModels = props.models.map((item, index) => (index === selectedIndex.value ? normalizedModel : item));
  updateModels(nextModels);
};

const addChatModel = () => {
  const nextModel = normalizeChatModelConfig({
    ...defaultModelFormDraft,
    name: append4Random("对话模型"),
    provider: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    modelType: "gpt-5.5",
    model: "gpt-5.5",
  });

  const nextModels = [...props.models, nextModel];
  updateModels(nextModels);
  selectedIndex.value = nextModels.length - 1;
};

const duplicateChatModel = () => {
  if (!currentModel.value) return;
  const duplicated = cloneModel(currentModel.value);
  duplicated.name = `${duplicated.name || "对话模型"}-copy`;
  const nextModels = [...props.models, duplicated];
  updateModels(nextModels);
  selectedIndex.value = nextModels.length - 1;
};

const deleteChatModel = () => {
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
