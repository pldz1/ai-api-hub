<template>
  <div class="model-form-card" :class="{ 'image-model-form': isImageModel }">
    <!-- Model identity, provider capability summary, and behavior hints -->
    <div class="model-form-header">
      <div>
        <h3>{{ t(isImageModel ? "user.modelCard.imageTitle" : "user.modelCard.chatTitle") }}</h3>
        <p>{{ t(isImageModel ? "user.modelCard.imageSubtitle" : "user.modelCard.chatSubtitle") }}</p>
        <div v-if="isImageModel" class="model-capability-row">
          <span>{{ isAzure ? "Azure OpenAI" : "OpenAI" }}</span>
          <span>{{ hasImageInputParam ? t("user.modelCard.imageInputEnabled") : t("user.modelCard.imageInputDisabled") }}</span>
        </div>
      </div>
    </div>

    <!-- Connection and request routing fields -->
    <section class="model-form-section">
      <div class="model-section-head">
        <h4>{{ t("user.modelCard.sections.connectionTitle") }}</h4>
        <p>{{ t("user.modelCard.sections.connectionDescription") }}</p>
      </div>

      <div class="model-form-grid">
        <!-- Shared display name field -->
        <label class="model-form-field">
          <span>{{ t("user.modelCard.fields.name") }}</span>
          <input v-model.trim="localModel.name" type="text" class="input input-bordered w-full" />
        </label>

        <!-- Chat model selector with grouped suggestions -->
        <label v-if="!isImageModel" class="model-form-field model-form-field-span">
          <span>{{ t("user.modelCard.fields.model") }}</span>
          <select v-model="localModel.model" class="model-select model-select-bordered w-full">
            <optgroup v-for="group in groupedModelSuggestions" :key="group.key" :label="group.label">
              <option v-for="item in group.items" :key="item.value" :value="item.value">{{ item.name }}</option>
            </optgroup>
          </select>
          <small>{{ t("user.modelCard.chatModelHelp") }}</small>
        </label>

        <!-- Provider selector changes the required connection fields below -->
        <label class="model-form-field">
          <span>{{ t("user.modelCard.fields.provider") }}</span>
          <select v-model="localModel.provider" class="model-select model-select-bordered w-full">
            <option v-for="ai in availableModelProviderList" :key="ai.value" :value="ai.value">{{ ai.name }}</option>
          </select>
        </label>

        <!-- Image model override for OpenAI-compatible endpoints -->
        <div v-if="isImageModel && !isAzure" class="model-form-field model-form-field-span">
          <label>{{ t("user.modelCard.fields.modelOverride") }}</label>
          <input v-model.trim="localModel.model" type="text" class="input input-bordered w-full" :placeholder="t('user.modelCard.placeholders.imageModelId')" />
          <small>{{ t("user.modelCard.imageModelHelp") }}</small>
          <div class="model-suggestion-list">
            <button
              v-for="item in modelSuggestions"
              :key="item.value"
              type="button"
              class="btn btn-sm"
              :class="localModel.model === item.value ? 'btn-neutral' : 'btn-outline'"
              @click="localModel.model = item.value"
            >
              {{ item.name }}
            </button>
          </div>
        </div>

        <!-- OpenAI-style base URL -->
        <label v-if="isOpenAIStyle" class="model-form-field model-form-field-span">
          <span>{{ isImageModel ? t("user.modelCard.fields.imageUrl") : t("user.modelCard.fields.baseUrl") }}</span>
          <input v-model.trim="localModel.baseURL" type="text" class="input input-bordered w-full" />
          <small v-if="isImageModel">{{ t("user.modelCard.imageBaseUrlHelp") }}</small>
        </label>

        <!-- Azure-specific connection fields -->
        <label v-if="isAzure" class="model-form-field model-form-field-span">
          <span>{{ t("user.modelCard.fields.endpoint") }}</span>
          <input v-model.trim="localModel.endpoint" type="text" class="input input-bordered w-full" />
          <small v-if="isImageModel">{{ t("user.modelCard.azureEndpointHelp") }}</small>
        </label>

        <label v-if="isAzure" class="model-form-field">
          <span>{{ t("user.modelCard.fields.apiVersion") }}</span>
          <input v-model.trim="localModel.apiVersion" type="text" class="input input-bordered w-full" />
          <small v-if="isImageModel">{{ t("user.modelCard.azureApiVersionHelp") }}</small>
        </label>

        <label v-if="isAzure" class="model-form-field">
          <span>{{ t("user.modelCard.fields.deployment") }}</span>
          <input v-model.trim="localModel.deployment" type="text" class="input input-bordered w-full" />
        </label>

        <!-- Secret entry with a copy helper -->
        <div class="model-form-field model-form-field-span">
          <label>{{ t("user.modelCard.fields.apiKey") }}</label>
          <label class="input input-bordered model-key-input">
            <input v-model.trim="localModel.apiKey" type="password" class="grow" />
            <button type="button" class="btn btn-ghost btn-sm" @click="copyApiKey">
              <SvgIcon :src="copyIcon" />
            </button>
          </label>
        </div>

        <!-- Read-only request target preview -->
        <label v-if="requestSummary" class="model-form-field model-form-field-span">
          <span>{{ t("user.modelCard.fields.requestTarget") }}</span>
          <div class="model-info-card">{{ requestSummary }}</div>
        </label>
      </div>
    </section>

    <!-- Chat model capability preview -->
    <section v-if="!isImageModel" class="model-form-section">
      <div class="model-section-head">
        <h4>{{ t("user.modelCard.capabilitiesTitle") }}</h4>
        <p>{{ t("user.modelCard.capabilitiesDescription") }}</p>
      </div>
      <div class="model-capability-grid">
        <div v-for="item in chatCapabilityRows" :key="item.key" class="model-capability-toggle" :class="{ disabled: !item.supported }">
          <span class="model-capability-indicator" :class="{ active: item.supported }"></span>
          <span>{{ item.label }}</span>
          <small>{{ item.supported ? t("user.modelCard.supportStates.supported") : t("user.modelCard.supportStates.unsupported") }}</small>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import { useI18n } from "vue-i18n";
import copyIcon from "@/assets/svg/copy16.svg";
import SvgIcon from "@/components/SvgIcon.vue";
import { chatDisplayedCapabilityKeys, defaultChatModelEditorState, imageModelProviderList, providerList } from "@/constants";
import { dsAlert } from "@/utils";
import { getChatModelCapabilities, imageParamDefs } from "@/models";
import type { ChatModelConfig, ChatModelEditorState, ImageModelConfig, ImageModelEditorState, ModelConfig, ModelKind, SelectOption } from "@/types";

type ModelEditorState = Omit<ChatModelEditorState, "provider"> & {
  provider: ChatModelEditorState["provider"] | ImageModelEditorState["provider"];
};
type ModelEditorInput = Partial<ModelConfig> & { apiType?: ModelEditorState["provider"] };

const props = withDefaults(
  defineProps<{
    model?: ModelEditorInput;
    modelSuggestions?: SelectOption[];
    kind?: ModelKind;
  }>(),
  {
    model: () => ({}),
    modelSuggestions: () => [],
    kind: "chat",
  },
);
const emit = defineEmits<{ "update:model": [model: ModelConfig] }>();
const { t } = useI18n();

const localModel = reactive<ModelEditorState>({
  ...structuredClone(defaultChatModelEditorState),
});
let isSyncingFromProps = false;
let lastModelSnapshot = "";

const isImageModel = computed(() => props.kind === "image");
const isAzure = computed(() => localModel.provider === "Azure OpenAI");
const isOpenAIStyle = computed(() => localModel.provider === "OpenAI" || localModel.provider === "Anthropic" || localModel.provider === "Azure AI Foundry");
const hasImageInputParam = computed(() => isImageModel.value && imageParamDefs.some((item) => item.type === "image"));
const resolvedModelId = computed(() => localModel?.model);

// Group suggestions by model family so the selector remains readable as options grow.
const getModelFamily = (model = "") => {
  const normalizedType = model.trim().toLowerCase();
  if (/^claude-/.test(normalizedType)) return "claude";
  if (/^(gpt-|o\d)/.test(normalizedType)) return "openai";
  return "custom";
};
const groupedModelSuggestions = computed(() => {
  const groups = [
    { key: "openai", label: t("user.modelCard.suggestionGroups.openai"), items: [] as SelectOption[] },
    { key: "claude", label: t("user.modelCard.suggestionGroups.claude"), items: [] as SelectOption[] },
    { key: "custom", label: t("user.modelCard.suggestionGroups.custom"), items: [] as SelectOption[] },
  ];
  const groupMap = new Map(groups.map((group) => [group.key, group]));
  const seen = new Set<string>();

  props.modelSuggestions.forEach((item) => {
    seen.add(item.value);
    groupMap.get(getModelFamily(item.value))?.items.push(item);
  });
  if (localModel.model && !seen.has(localModel.model)) {
    groupMap.get(getModelFamily(localModel.model))?.items.push({ value: localModel.model, name: localModel.model });
  }
  return groups.filter((group) => group.items.length > 0);
});
const availableModelProviderList = computed(() => {
  // Limit providers to combinations that the request builders can route correctly.
  if (isImageModel.value) return imageModelProviderList;
  const modelFamily = getModelFamily(localModel.model);
  const allowedProviders =
    modelFamily === "claude"
      ? new Set(["Anthropic", "Azure AI Foundry"])
      : modelFamily === "openai"
        ? new Set(["OpenAI", "Azure OpenAI"])
        : new Set(providerList.map((item) => item.value));
  return providerList.filter((item) => allowedProviders.has(item.value));
});

const requestSummary = computed(() => {
  // Show the target route that will be used after provider-specific normalization.
  if (isImageModel.value) {
    if (isAzure.value) return localModel.deployment ? t("user.modelCard.azureRequestTarget", { deployment: localModel.deployment }) : "";
    return localModel.baseURL ? t("user.modelCard.imageRequestTarget", { url: localModel.baseURL }) : "";
  }
  if (isAzure.value) return localModel.deployment ? t("user.modelCard.azureRequestTarget", { deployment: localModel.deployment }) : "";
  return resolvedModelId.value ? t("user.modelCard.openAIRequestTarget", { model: resolvedModelId.value }) : "";
});
const capabilityLabelKeys: Record<string, string> = {
  webSearch: "input.capabilities.webSearch",
  imageRead: "input.capabilities.imageRead",
};
const chatCapabilityRows = computed(() => {
  const supported = getChatModelCapabilities(localModel.model, localModel.provider);
  return chatDisplayedCapabilityKeys.map((key) => ({
    key,
    label: t(capabilityLabelKeys[key] || key),
    supported: supported[key],
  }));
});
const providerDefaultBaseUrls: Record<string, string> = {
  OpenAI: "https://api.openai.com/v1",
  Anthropic: "https://api.anthropic.com",
};

function createEmptyModelEditorState(): ModelEditorState {
  return {
    ...structuredClone(defaultChatModelEditorState),
  };
}

function syncProviderBaseURL(provider = "", force = false) {
  // Auto-fill defaults only while the user has not customized the base URL.
  if ((!force && isSyncingFromProps) || isImageModel.value) return;
  const knownDefaults = Object.values(providerDefaultBaseUrls);
  const nextDefault = providerDefaultBaseUrls[provider] || "";
  const shouldReplace = !localModel.baseURL || knownDefaults.includes(localModel.baseURL);
  if (shouldReplace) localModel.baseURL = nextDefault;
}

function syncProviderForModel(force = false) {
  // Keep provider valid when switching between OpenAI and Claude model families.
  if ((!force && isSyncingFromProps) || isImageModel.value) return;
  if (!availableModelProviderList.value.some((item) => item.value === localModel.provider)) {
    localModel.provider = availableModelProviderList.value[0]?.value || "";
  }
}

function normalizeModelFields() {
  // Remove incompatible fields before emitting so persisted models have one routing shape.
  const modelId = localModel.model.trim();
  if (isImageModel.value) {
    localModel.provider = localModel.provider === "Azure OpenAI" ? "Azure OpenAI" : "OpenAI";
    localModel.model = modelId;
    if (localModel.provider === "Azure OpenAI") {
      localModel.baseURL = "";
      return;
    }
    localModel.endpoint = "";
    localModel.deployment = "";
    localModel.apiVersion = "";
    return;
  }

  localModel.model = modelId;
  if (isAzure.value) {
    localModel.baseURL = "";
    return;
  }
  if (isOpenAIStyle.value) {
    localModel.endpoint = "";
    localModel.deployment = "";
    localModel.apiVersion = "";
  }
}

function buildChatModelPayload(): ChatModelConfig {
  const basePayload = {
    name: localModel.name,
    apiKey: localModel.apiKey,
    model: localModel.model,
  };

  if (localModel.provider === "Azure OpenAI") {
    return {
      ...basePayload,
      provider: "Azure OpenAI",
      endpoint: localModel.endpoint,
      deployment: localModel.deployment,
      apiVersion: localModel.apiVersion,
    };
  }

  return {
    ...basePayload,
    provider: (localModel.provider || "OpenAI") as Exclude<ChatModelConfig["provider"], "Azure OpenAI">,
    baseURL: localModel.baseURL,
  };
}

function buildImageModelPayload(): ImageModelConfig {
  const basePayload = {
    name: localModel.name,
    apiKey: localModel.apiKey,
    model: localModel.model,
  };

  if (localModel.provider === "Azure OpenAI") {
    return {
      ...basePayload,
      provider: "Azure OpenAI",
      endpoint: localModel.endpoint,
      deployment: localModel.deployment,
      apiVersion: localModel.apiVersion,
    };
  }

  return {
    ...basePayload,
    provider: "OpenAI",
    baseURL: localModel.baseURL,
  };
}

function createModelPayload(): ModelConfig {
  normalizeModelFields();
  return isImageModel.value ? buildImageModelPayload() : buildChatModelPayload();
}

function syncFromProps(model?: ModelEditorInput) {
  // Sync external selection changes into local edit state without immediately re-emitting.
  const legacyModel = model || {};
  isSyncingFromProps = true;
  Object.assign(localModel, createEmptyModelEditorState(), model || {}, {
    provider: legacyModel.provider || legacyModel.apiType || "",
  });
  normalizeModelFields();
  syncProviderForModel(true);
  syncProviderBaseURL(localModel.provider, true);
  lastModelSnapshot = JSON.stringify(createModelPayload());
  isSyncingFromProps = false;
}

function emitModelUpdate() {
  // Snapshot comparisons avoid parent update loops while fields are normalized in place.
  if (isSyncingFromProps) return;
  const nextModel = createModelPayload();
  const nextSnapshot = JSON.stringify(nextModel);
  if (nextSnapshot === lastModelSnapshot) return;
  lastModelSnapshot = nextSnapshot;
  emit("update:model", nextModel);
}

function copyApiKey() {
  navigator.clipboard
    .writeText(localModel.apiKey)
    .then(() => dsAlert({ type: "success", message: t("toast.copyApiKeySuccess") }))
    .catch((err) => dsAlert({ type: "error", message: t("toast.copyApiKeyFailed", { error: String(err) }) }));
}

watch(
  () => props.model,
  (newModel) => syncFromProps(newModel),
  { deep: true, immediate: true },
);

watch(
  () => [localModel.provider, localModel.model],
  () => {
    if (isSyncingFromProps || isImageModel.value) return;
    syncProviderForModel();
    syncProviderBaseURL(localModel.provider);
  },
);

watch(
  () => JSON.stringify(localModel),
  () => emitModelUpdate(),
);
</script>

<style lang="scss" scoped>
.model-form-card {
  border: 1px solid oklch(var(--bc) / 0.07);
  border-radius: 22px;
  background: oklch(var(--b1) / 0.82);
  padding: 24px;
  box-shadow: 0 10px 28px oklch(var(--bc) / 0.04);
}

.model-form-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 18px;

  h3 {
    font-size: 18px;
    line-height: 1.15;
    font-weight: 600;
    color: oklch(var(--bc));
  }

  p {
    margin-top: 6px;
    font-size: 12px;
    color: oklch(var(--bc) / 0.68);
  }
}

.model-capability-row {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 10px;

  span {
    border-radius: 999px;
    padding: 5px 9px;
    border: 1px solid oklch(var(--bc) / 0.06);
    background: oklch(var(--b1) / 0.84);
    color: oklch(var(--bc) / 0.68);
    font-size: 11px;
    font-weight: 700;
  }
}
.model-form-section {
  margin-top: 18px;
  border: 1px solid oklch(var(--bc) / 0.06);
  border-radius: 18px;
  padding: 18px;
  background: oklch(var(--b1) / 0.68);
}

.model-section-head {
  margin-bottom: 14px;

  h4 {
    font-size: 14px;
    font-weight: 700;
    color: oklch(var(--bc));
  }

  p {
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.5;
    color: oklch(var(--bc) / 0.68);
  }
}

.model-form-grid,
.model-capability-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 18px;
}

.model-form-field {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;

  span,
  label {
    font-size: 12px;
    font-weight: 600;
    color: oklch(var(--bc) / 0.82);
  }

  small {
    font-size: 11px;
    line-height: 1.5;
    color: oklch(var(--bc) / 0.62);
  }
}

.model-select {
  min-height: 42px;
  padding: 0 38px 0 14px;
  border-radius: 14px;
  border: 1px solid oklch(var(--bc) / 0.1);
  background:
    linear-gradient(180deg, oklch(var(--b1) / 0.98), oklch(var(--b2) / 0.92)),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M4 6L8 10L12 6' stroke='currentColor' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")
      no-repeat right 12px center / 12px 12px;
  color: oklch(var(--bc));
  appearance: none;
  box-shadow: 0 8px 20px oklch(var(--bc) / 0.05);
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    transform 0.18s ease;

  &:hover {
    border-color: oklch(var(--bc) / 0.18);
    transform: translateY(-1px);
  }

  &:focus {
    outline: none;
    border-color: oklch(var(--p) / 0.42);
    box-shadow:
      0 0 0 3px oklch(var(--p) / 0.12),
      0 12px 26px oklch(var(--bc) / 0.08);
  }
}

.model-form-field-span {
  grid-column: 1 / -1;
}

.model-key-input {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 52px;
  background: oklch(var(--b1) / 0.96);

  input {
    flex: 1;
    min-width: 0;
  }
}

.model-suggestion-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  .btn {
    min-height: 36px;
    padding-inline: 12px;
    border-radius: 999px;
    font-size: 12px;
  }
}

.model-info-card {
  border-radius: 14px;
  padding: 12px 14px;
  background-color: oklch(var(--b2));
  font-size: 12px;
  line-height: 1.5;
  color: oklch(var(--bc) / 0.82);
  border: 1px solid oklch(var(--bc) / 0.05);
}

.model-capability-toggle {
  min-height: 48px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 2px 10px;
  align-items: center;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid oklch(var(--bc) / 0.08);
  background: oklch(var(--b1) / 0.74);

  .model-capability-indicator {
    width: 11px;
    height: 11px;
    grid-row: span 2;
    border-radius: 50%;
    border: 1px solid oklch(var(--bc) / 0.32);

    &.active {
      border-color: oklch(var(--p) / 0.32);
      background: oklch(var(--p));
      box-shadow: 0 0 0 3px oklch(var(--p) / 0.1);
    }
  }

  span {
    font-size: 12px;
    font-weight: 700;
    color: oklch(var(--bc));
  }

  small {
    font-size: 11px;
    color: oklch(var(--bc) / 0.62);
  }

  &.disabled {
    opacity: 0.55;
  }
}

@media (max-width: 900px) {
  .model-form-grid,
  .model-capability-grid {
    grid-template-columns: 1fr;
  }

  .model-form-header {
    flex-direction: column;
  }
}
</style>
