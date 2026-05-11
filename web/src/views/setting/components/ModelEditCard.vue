<template>
  <div class="model-form-card" :class="{ 'image-model-form': isImageModel }">
    <div class="model-form-header">
      <div>
        <h3>{{ t(cardTitleKey) }}</h3>
        <p>{{ t(cardSubtitleKey) }}</p>
        <div v-if="isImageModel" class="model-capability-row">
          <span>{{ activeProtocolLabel }}</span>
          <span>{{ hasImageInputParam ? t("user.modelCard.imageInputEnabled") : t("user.modelCard.imageInputDisabled") }}</span>
        </div>
      </div>
      <div v-if="props.modelKind === 'chat' && localModel.model" class="model-behavior-chip">
        {{ modelBehaviorHint }}
      </div>
    </div>

    <section class="model-form-section">
      <div class="model-section-head">
        <h4>{{ t("user.modelCard.sections.connectionTitle") }}</h4>
        <p>{{ t("user.modelCard.sections.connectionDescription") }}</p>
      </div>

      <div class="model-form-grid">
        <div class="model-form-field">
          <label>{{ t("user.modelCard.fields.name") }}</label>
          <input type="text" class="input input-bordered w-full" v-model.trim="localModel.name" />
        </div>

        <div v-if="!isImageModel" class="model-form-field model-form-field-span">
          <label>{{ t("user.modelCard.fields.model") }}</label>
          <select class="select select-bordered w-full" v-model="localModel.model">
            <optgroup v-for="group in groupedModelSuggestions" :key="group.key" :label="group.label">
              <option v-for="item in group.items" :key="item.value" :value="item.value">
                {{ item.name }}
              </option>
            </optgroup>
          </select>
          <div class="model-field-help">
            {{ t("user.modelCard.chatModelHelp") }}
          </div>
        </div>

        <div class="model-form-field">
          <label>{{ t("user.modelCard.fields.provider") }}</label>
          <select class="select select-bordered w-full" v-model="localModel.provider">
            <option v-for="ai in availableModelProviderList" :key="ai.value" :value="ai.value">
              {{ ai.name }}
            </option>
          </select>
        </div>

        <div v-if="isImageModel && !isAzure" class="model-form-field model-form-field-span">
          <label>{{ t("user.modelCard.fields.modelOverride") }}</label>
          <input type="text" class="input input-bordered w-full" :placeholder="modelPlaceholder" v-model.trim="localModel.model" />
          <div class="model-field-help">
            {{ t("user.modelCard.imageModelHelp") }}
          </div>
          <div class="model-suggestion-list">
            <button
              v-for="item in visibleModelSuggestions"
              :key="item.value"
              type="button"
              class="btn btn-sm"
              :class="localModel.model === item.value ? 'btn-neutral' : 'btn-outline'"
              @click="applySuggestedModel(item.value)"
            >
              {{ item.name }}
            </button>
          </div>
        </div>

        <div v-if="isOpenAIStyle" class="model-form-field model-form-field-span">
          <label>{{ isImageModel ? t("user.modelCard.fields.imageUrl") : t("user.modelCard.fields.baseUrl") }}</label>
          <input type="text" class="input input-bordered w-full" v-model.trim="localModel.baseURL" />
          <div v-if="isImageModel" class="model-field-help">
            {{ t("user.modelCard.imageBaseUrlHelp") }}
          </div>
        </div>

        <div v-if="isAzure" class="model-form-field model-form-field-span">
          <label>{{ t("user.modelCard.fields.endpoint") }}</label>
          <input type="text" class="input input-bordered w-full" v-model.trim="localModel.endpoint" />
          <div v-if="isImageModel" class="model-field-help">
            {{ t("user.modelCard.azureEndpointHelp") }}
          </div>
        </div>

        <div v-if="isAzure" class="model-form-field">
          <label>{{ t("user.modelCard.fields.apiVersion") }}</label>
          <input type="text" class="input input-bordered w-full" v-model.trim="localModel.apiVersion" />
          <div v-if="isImageModel" class="model-field-help">
            {{ t("user.modelCard.azureApiVersionHelp") }}
          </div>
        </div>

        <div v-if="isAzure" class="model-form-field">
          <label>{{ t("user.modelCard.fields.deployment") }}</label>
          <input type="text" class="input input-bordered w-full" v-model.trim="localModel.deployment" />
        </div>

        <div class="model-form-field model-form-field-span">
          <label>{{ t("user.modelCard.fields.apiKey") }}</label>
          <label class="input input-bordered model-key-input">
            <input type="password" class="grow" v-model.trim="localModel.apiKey" />
            <button type="button" class="btn btn-ghost btn-sm" @click="copyApiKey">
              <SvgIcon :src="copyIcon" />
            </button>
          </label>
        </div>

        <div v-if="requestSummary" class="model-form-field model-form-field-span">
          <label>{{ t("user.modelCard.fields.requestTarget") }}</label>
          <div class="model-info-card">
            {{ requestSummary }}
          </div>
        </div>
      </div>
    </section>

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
import { dsAlert } from "@/utils";
import copyIcon from "@/assets/svg/copy16.svg";
import SvgIcon from "@/components/base/SvgIcon.vue";
import type { ImageOperation, ModelConfig, ModelFormDraft, ModelKind, SelectOption } from "@/types/model";
import {
  defaultModelFormDraft,
  providerList,
  chatDisplayedCapabilityKeys,
  imageModelProviderList,
  getChatModelInfo,
  getChatModelCapabilities,
  getModelImageParamDefs,
  getModelRequestId,
  normalizeChatModelConfig,
  normalizeImageModelConfig,
} from "@/constants";

const props = withDefaults(
  defineProps<{
    model?: Partial<ModelFormDraft>;
    modelSuggestions?: SelectOption[];
    modelKind?: ModelKind;
    imageOperation?: ImageOperation;
  }>(),
  {
    model: () => structuredClone(defaultModelFormDraft),
    modelSuggestions: () => [],
    modelKind: "chat",
    imageOperation: "generation",
  },
);

const emit = defineEmits<{
  "update:model": [model: ModelConfig];
}>();
const { t } = useI18n();
const localModel = reactive<ModelFormDraft>(structuredClone(defaultModelFormDraft));
let isSyncingFromProps = false;
let lastModelSnapshot = "";

const visibleModelSuggestions = computed(() => props.modelSuggestions);
const capabilityLabelKeys: Record<string, string> = {
  reasoning: "input.capabilities.reasoning",
  webSearch: "input.capabilities.webSearch",
  imageRead: "input.capabilities.imageRead",
};
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

  visibleModelSuggestions.value.forEach((item) => {
    seen.add(item.value);
    groupMap.get(getModelFamily(item.value))?.items.push(item);
  });

  if (localModel.model && !seen.has(localModel.model)) {
    groupMap.get(getModelFamily(localModel.model))?.items.push({ value: localModel.model, name: localModel.model });
  }

  return groups.filter((group) => group.items.length > 0);
});
const availableModelProviderList = computed(() => {
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
const isImageModel = computed(() => props.modelKind === "image");
const isAzure = computed(() => localModel.provider === "Azure OpenAI");
const isOpenAIStyle = computed(() => localModel.provider === "OpenAI" || localModel.provider === "Anthropic" || localModel.provider === "Azure AI Foundry");
const hasImageInputParam = computed(() => isImageModel.value && getModelImageParamDefs(localModel).some((item) => item.type === "image"));
const activeProtocolLabel = computed(() => (isAzure.value ? "Azure OpenAI" : "OpenAI"));
const modelPlaceholder = computed(() => {
  return props.modelKind === "image" ? t("user.modelCard.placeholders.imageModelId") : t("user.modelCard.placeholders.chatModelId");
});
const resolvedModelId = computed(() => getModelRequestId(localModel));
const modelBehaviorHint = computed(() => {
  const modelInfo = getChatModelInfo(localModel.model, localModel.provider);
  const modeText = modelInfo.isReasonModel ? t("user.modelCard.behavior.reasoning") : t("user.modelCard.behavior.chat");
  const formatText = modelInfo.msgTypeVersion === "v1" ? t("user.modelCard.behavior.v1") : t("user.modelCard.behavior.v2");
  return `${modeText} · ${formatText}`;
});
const requestSummary = computed(() => {
  if (isImageModel.value) {
    if (isAzure.value) {
      if (!localModel.deployment) return "";
      return t("user.modelCard.azureRequestTarget", { deployment: localModel.deployment });
    }

    return localModel.baseURL ? t("user.modelCard.imageRequestTarget", { url: localModel.baseURL }) : "";
  }

  if (isAzure.value) {
    if (!localModel.deployment) return "";
    return t("user.modelCard.azureRequestTarget", { deployment: localModel.deployment });
  }

  if (!resolvedModelId.value) return "";
  return t("user.modelCard.openAIRequestTarget", { model: resolvedModelId.value });
});
const cardTitleKey = computed(() => (props.modelKind === "image" ? "user.modelCard.imageTitle" : "user.modelCard.chatTitle"));
const cardSubtitleKey = computed(() => (props.modelKind === "image" ? "user.modelCard.imageSubtitle" : "user.modelCard.chatSubtitle"));
const supportedChatCapabilities = computed(() => getChatModelCapabilities(localModel.model, localModel.provider));
const chatCapabilityRows = computed(() =>
  chatDisplayedCapabilityKeys.map((key) => ({
    key,
    label: t(capabilityLabelKeys[key] || key),
    supported: supportedChatCapabilities.value[key],
  })),
);
const providerDefaultBaseUrls: Record<string, string> = {
  OpenAI: "https://api.openai.com/v1",
  Anthropic: "https://api.anthropic.com",
};

function syncProviderBaseURL(provider = "", force = false) {
  if ((!force && isSyncingFromProps) || isImageModel.value) return;
  const knownDefaults = Object.values(providerDefaultBaseUrls);
  const nextDefault = providerDefaultBaseUrls[provider] || "";
  const shouldReplace = !localModel.baseURL || knownDefaults.includes(localModel.baseURL);
  if (shouldReplace) localModel.baseURL = nextDefault;
}

function syncProviderForModel(force = false) {
  if ((!force && isSyncingFromProps) || isImageModel.value) return;
  if (!availableModelProviderList.value.some((item) => item.value === localModel.provider)) {
    localModel.provider = availableModelProviderList.value[0]?.value || "";
  }
}

function normalizeModelFields() {
  const modelId = localModel.model.trim();

  if (isImageModel.value) {
    localModel.provider = localModel.provider === "Azure OpenAI" ? "Azure OpenAI" : "OpenAI";
    localModel.imageOperation = props.imageOperation;
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

function createModelPayload(): ModelConfig {
  normalizeModelFields();
  if (props.modelKind === "image") {
    return normalizeImageModelConfig(JSON.parse(JSON.stringify(localModel)), props.imageOperation);
  }

  return normalizeChatModelConfig(JSON.parse(JSON.stringify(localModel)));
}

function syncFromProps(model?: Partial<ModelFormDraft>) {
  const legacyModel = model as Partial<ModelFormDraft> & { apiType?: ModelFormDraft["provider"] };
  isSyncingFromProps = true;
  Object.assign(localModel, structuredClone(defaultModelFormDraft), model || {}, {
    provider: legacyModel?.provider || legacyModel?.apiType || "",
  });
  localModel.enabledCapabilities = { ...(model?.enabledCapabilities || {}) };
  normalizeModelFields();
  syncProviderForModel(true);
  syncProviderBaseURL(localModel.provider, true);
  lastModelSnapshot = JSON.stringify(createModelPayload());
  isSyncingFromProps = false;
}

function emitModelUpdate() {
  if (isSyncingFromProps) return;
  const nextModel = createModelPayload();
  const nextSnapshot = JSON.stringify(nextModel);
  if (nextSnapshot === lastModelSnapshot) return;
  lastModelSnapshot = nextSnapshot;
  emit("update:model", nextModel);
}

const applySuggestedModel = (value: string) => {
  localModel.model = value;
};

const copyApiKey = () => {
  navigator.clipboard
    .writeText(localModel.apiKey)
    .then(() => {
      dsAlert({ type: "success", message: t("toast.copyApiKeySuccess") });
    })
    .catch((err) => {
      dsAlert({ type: "error", message: t("toast.copyApiKeyFailed", { error: String(err) }) });
    });
};

watch(
  () => props.model,
  (newModel) => {
    syncFromProps(newModel);
  },
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
  () => {
    emitModelUpdate();
  },
);
</script>

<style lang="scss" scoped>
.model-form-card {
  border: 1px solid oklch(var(--b3) / 0.65);
  border-radius: 20px;
  background: linear-gradient(180deg, oklch(var(--b1)) 0%, oklch(var(--b2) / 0.65) 100%);
  padding: 24px;
  box-shadow:
    0 12px 32px oklch(var(--n) / 0.04),
    inset 0 1px 0 oklch(var(--b1) / 0.92);
}

.image-model-form {
  padding: 20px;

  .model-form-section {
    margin-top: 14px;
  }
}

.model-form-section {
  margin-top: 18px;
  border: 1px solid oklch(var(--b3) / 0.55);
  border-radius: 18px;
  padding: 18px;
  background: linear-gradient(180deg, oklch(var(--b1) / 0.88), oklch(var(--b2) / 0.68));
}

.model-section-head {
  margin-bottom: 14px;

  h4 {
    font-size: 14px;
    font-weight: 700;
    color: oklch(var(--bc) / 0.92);
  }

  p {
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.5;
    color: oklch(var(--bc) / 0.62);
  }
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
    font-weight: 700;
  }

  p {
    margin-top: 6px;
    font-size: 12px;
    color: oklch(var(--bc) / 0.65);
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
    border: 1px solid oklch(var(--bc) / 0.07);
    background: oklch(var(--b1) / 0.72);
    color: oklch(var(--bc) / 0.66);
    font-size: 11px;
    font-weight: 700;
  }
}

.model-capability-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.model-capability-toggle {
  min-width: 0;
  min-height: 48px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 2px 10px;
  align-items: center;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid oklch(var(--bc) / 0.1);
  background: oklch(var(--b1) / 0.62);

  .model-capability-indicator {
    width: 11px;
    height: 11px;
    grid-row: span 2;
    border-radius: 50%;
    border: 1px solid oklch(var(--bc) / 0.24);

    &.active {
      border-color: oklch(var(--p) / 0.36);
      background: oklch(var(--p));
      box-shadow: 0 0 0 3px oklch(var(--p) / 0.1);
    }
  }

  span {
    font-size: 12px;
    font-weight: 700;
    color: oklch(var(--bc) / 0.82);
  }

  small {
    font-size: 11px;
    color: oklch(var(--bc) / 0.5);
  }

  &.disabled {
    opacity: 0.55;
  }
}

.model-behavior-chip {
  flex-shrink: 0;
  border-radius: 999px;
  padding: 7px 11px;
  background-color: oklch(var(--n) / 0.08);
  font-size: 11px;
  color: oklch(var(--bc) / 0.7);
}

.model-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px 18px;
}

.model-form-field {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;

  label {
    font-size: 12px;
    font-weight: 600;
    color: oklch(var(--bc) / 0.85);
  }
}

.image-model-form .model-form-field {
  gap: 6px;
}

.image-model-form :deep(.input),
.image-model-form :deep(.select) {
  min-height: 46px;
  border-radius: 14px;
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

  input {
    flex: 1;
    min-width: 0;
  }

  .btn {
    margin-left: auto;
    flex-shrink: 0;
  }
}

.model-field-help {
  font-size: 11px;
  line-height: 1.5;
  color: oklch(var(--bc) / 0.62);
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
  background-color: oklch(var(--n) / 0.07);
  font-size: 12px;
  line-height: 1.5;
  color: oklch(var(--bc) / 0.75);

  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
}

@media (max-width: 900px) {
  .model-form-grid {
    grid-template-columns: 1fr;
  }

  .model-form-header {
    flex-direction: column;
  }
}
</style>
