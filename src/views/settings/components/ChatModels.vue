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

        <button class="btn btn-outline btn-error" :disabled="selectedIndex === -1" @click="deleteChatModel">
          {{ t("user.chatModels.delete") }}
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
            <span>{{ chatModel.model || t("common.unsetModelId") }}</span>
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
import { chatModelTypeList } from "@/constants";
import { append4Random } from "@/utils";
import ModelEditCard from "@/views/settings/components/ModelEditCard.vue";
import type { ChatModelConfig } from "@/types/chat";
import type { ModelConfig } from "@/types/settings";

const props = withDefaults(defineProps<{ models?: ChatModelConfig[] }>(), {
  models: () => [],
});

const emit = defineEmits<{ "update:models": [models: ChatModelConfig[]] }>();
const { t } = useI18n();
const selectedIndex = ref(-1);

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
  const updatedModel = nextModel as ChatModelConfig;
  if (JSON.stringify(props.models[selectedIndex.value]) === JSON.stringify(updatedModel)) return;
  const nextModels = props.models.map((item, index) => (index === selectedIndex.value ? updatedModel : item));
  updateModels(nextModels);
};

const addChatModel = () => {
  const nextModel: ChatModelConfig = {
    name: append4Random(t("user.chatModels.defaultName")),
    provider: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-5.5",
  };

  const nextModels = [...props.models, nextModel];
  updateModels(nextModels);
  selectedIndex.value = nextModels.length - 1;
};

const buildDuplicatedChatModel = (model: ChatModelConfig): ChatModelConfig =>
  ({
    name: `${model.name || t("user.chatModels.defaultName")}-${t("common.duplicateSuffix")}`,
    provider: model.provider,
    apiKey: model.apiKey,
    model: model.model,
    ...("baseURL" in model ? { baseURL: model.baseURL } : {}),
    ...("endpoint" in model ? { endpoint: model.endpoint } : {}),
    ...("deployment" in model ? { deployment: model.deployment } : {}),
    ...("apiVersion" in model ? { apiVersion: model.apiVersion } : {}),
    ...(model.enabledCapabilitiesMode === "custom"
      ? {
          enabledCapabilitiesMode: "custom" as const,
          enabledCapabilities: structuredClone(model.enabledCapabilities || {}),
        }
      : {}),
  }) as ChatModelConfig;

const duplicateChatModel = () => {
  if (!currentModel.value) return;
  const duplicated = buildDuplicatedChatModel(currentModel.value);
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
