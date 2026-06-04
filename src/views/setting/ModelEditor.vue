<template>
  <div class="model-form-card" :class="{ 'image-model-form': isImageModel || isVideoModel }">
    <!-- Connection and request routing fields -->
    <section class="model-form-section model-connection-section">
      <div class="model-form-grid">
        <!-- Shared display name field -->
        <label class="model-form-field model-form-field-span">
          <span>{{ t("user.modelCard.fields.name") }}</span>
          <input v-model.trim="localModel.name" type="text" class="input input-bordered w-full" />
        </label>

        <!-- Shared model selector -->
        <label class="model-form-field">
          <span>{{ t("user.modelCard.fields.model") }}</span>
          <select v-model="localModel.model" class="model-select model-select-bordered w-full">
            <option v-for="modelName in availableModelOptions" :key="modelName" :value="modelName">{{ modelName }}</option>
          </select>
        </label>

        <!-- Provider selector changes the required connection fields below -->
        <label class="model-form-field">
          <span>{{ t("user.modelCard.fields.provider") }}</span>
          <select v-model="localModel.provider" class="model-select model-select-bordered w-full">
            <option v-for="ai in availableModelProviderList" :key="getProviderValue(ai)" :value="getProviderValue(ai)">{{ getProviderLabel(ai) }}</option>
          </select>
        </label>

        <!-- OpenAI-style base URL -->
        <label v-if="usesBaseURL" class="model-form-field model-form-field-span">
          <span>{{ isImageModel || isVideoModel ? t("user.modelCard.fields.imageUrl") : t("user.modelCard.fields.baseUrl") }}</span>
          <input v-model.trim="localModel.baseURL" type="text" class="input input-bordered w-full" />
          <small v-if="isImageModel || isVideoModel">{{ t("user.modelCard.imageBaseUrlHelp") }}</small>
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

        <!-- Proxy toggle: only for video models (DashScope CORS workaround) -->
        <label v-if="isVideoModel" class="model-form-field model-form-field-span model-proxy-toggle">
          <span class="proxy-toggle-row">
            <input v-model="localModel.useProxy" type="checkbox" class="checkbox checkbox-sm" />
            <span>{{ t("user.videoModels.useProxy") }}</span>
          </span>
          <small>{{ t("user.videoModels.useProxyHelp") }}</small>
        </label>
      </div>
    </section>

    <!-- Chat model capability preview -->
    <section v-if="!isImageModel && !isVideoModel" class="model-form-section">
      <div class="model-section-head">
        <h4>{{ t("user.modelCard.capabilitiesTitle") }}</h4>
        <p>{{ t("user.modelCard.capabilitiesDescription") }}</p>
      </div>
      <div class="model-capability-grid">
        <div v-for="item in chatCapabilityRows" :key="item.key" class="model-capability-toggle" :class="{ disabled: !item.supported }">
          <span class="model-capability-indicator" :class="{ active: item.supported }"></span>
          <span class="model-capability-label">{{ item.label }}</span>
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
import {
  chatDisplayedCapabilityKeys,
  defaultChatModelEditorState,
  imageModelProviderList,
  videoModelProviderList,
  chatProviderKeys,
  chatModelTypeList,
  imageModelTypeList,
  videoModelTypeList,
} from "@/constants";
import { dsAlert } from "@/utils";
import {
  getChatModelCapabilities,
  chatProviderUsesField,
  getChatProviderDefinition,
  getChatProviderDefaultBaseURL,
  getChatProvidersForModel,
  getKnownChatProviderDefaultBaseURLs,
  getImageProviderDefinition,
  getImageProviderDefaultBaseURL,
  getImageProvidersForModel,
  getKnownImageProviderDefaultBaseURLs,
  imageProviderUsesField,
  getVideoProviderDefinition,
  getVideoProviderDefaultBaseURL,
  getVideoProvidersForModel,
  getKnownVideoProviderDefaultBaseURLs,
  videoProviderUsesField,
} from "@/models";

import type {
  ChatModelConfig,
  ChatModelEditorState,
  ImageModelConfig,
  ImageModelEditorState,
  VideoModelConfig,
  ModelConfig,
  ModelKind,
} from "@/types";

type ModelEditorState = Omit<ChatModelEditorState, "provider"> & {
  provider: ChatModelEditorState["provider"] | ImageModelEditorState["provider"];
  useProxy?: boolean;
};
type ModelEditorInput = Partial<ModelConfig> & { apiType?: ModelEditorState["provider"] };
type ProviderSuggestion = ModelEditorState["provider"];

const props = withDefaults(
  defineProps<{
    model?: ModelEditorInput;
    kind?: ModelKind;
  }>(),
  {
    model: () => ({}),
    kind: "chat",
  },
);
const emit = defineEmits<{
  "update:model": [model: ModelConfig];
}>();
const { t } = useI18n();

const localModel = reactive<ModelEditorState>({
  ...structuredClone(defaultChatModelEditorState),
});
let isSyncingFromProps = false;
let lastModelSnapshot = "";

const isImageModel = computed(() => props.kind === "image");
const isVideoModel = computed(() => props.kind === "video");
const usesBaseURL = computed(() =>
  isVideoModel.value
    ? videoProviderUsesField(localModel.provider, "baseURL")
    : isImageModel.value
    ? imageProviderUsesField(localModel.provider, "baseURL")
    : chatProviderUsesField(localModel.provider, "baseURL"),
);
const availableModelOptions = computed(() => {
  const catalog = isVideoModel.value ? videoModelTypeList : isImageModel.value ? imageModelTypeList : chatModelTypeList;
  const options = catalog.map((item) => item.name);
  const currentModel = String(localModel.model || "").trim();

  if (currentModel && !options.includes(currentModel)) {
    return [currentModel, ...options];
  }

  return options;
});

const availableModelProviderList = computed(() => {
  // Limit providers to combinations that the request builders can route correctly.
  if (isVideoModel.value) {
    const allowedProviders = new Set(getVideoProvidersForModel(localModel.model));
    return videoModelProviderList.filter((item) => allowedProviders.has(item));
  }
  if (isImageModel.value) {
    const allowedProviders = new Set(getImageProvidersForModel(localModel.model));
    return imageModelProviderList.filter((item) => allowedProviders.has(item));
  }
  const allowedProviders = new Set(getChatProvidersForModel(localModel.model));
  return chatProviderKeys.filter((item) => allowedProviders.has(item));
});

const capabilityLabelKeys: Record<string, string> = {
  webSearch: "input.capabilities.webSearch",
  imageRead: "input.capabilities.imageRead",
};
const chatCapabilityRows = computed(() => {
  const supported = getChatModelCapabilities(localModel);
  return chatDisplayedCapabilityKeys.map((key) => ({
    key,
    label: t(capabilityLabelKeys[key] || key),
    supported: supported[key],
  }));
});
function createEmptyModelEditorState(): ModelEditorState {
  return {
    ...structuredClone(defaultChatModelEditorState),
  };
}

function getProviderValue(item: ProviderSuggestion): ModelEditorState["provider"] {
  return item;
}

function getProviderLabel(item: string): string {
  if (isVideoModel.value) return getVideoProviderDefinition(item)?.name || item;
  return (isImageModel.value ? getImageProviderDefinition(item)?.name : getChatProviderDefinition(item)?.name) || item;
}

function syncProviderBaseURL(provider = "", force = false) {
  // Auto-fill defaults only while the user has not customized the base URL.
  if (!force && isSyncingFromProps) return;
  const knownDefaults = isVideoModel.value
    ? getKnownVideoProviderDefaultBaseURLs()
    : isImageModel.value
    ? getKnownImageProviderDefaultBaseURLs()
    : getKnownChatProviderDefaultBaseURLs();
  const nextDefault = isVideoModel.value
    ? getVideoProviderDefaultBaseURL(provider)
    : isImageModel.value
    ? getImageProviderDefaultBaseURL(provider)
    : getChatProviderDefaultBaseURL(provider);
  const shouldReplace = !localModel.baseURL || knownDefaults.includes(localModel.baseURL);
  if (shouldReplace) localModel.baseURL = nextDefault;
}

function syncProviderForModel(force = false) {
  // Keep provider valid for the selected catalog model.
  if (!force && isSyncingFromProps) return;
  if (!availableModelProviderList.value.some((item) => getProviderValue(item) === localModel.provider)) {
    localModel.provider = getProviderValue(availableModelProviderList.value[0] || "");
  }
}

function normalizeModelDraft(source: ModelEditorState = localModel): ModelEditorState {
  const next: ModelEditorState = {
    name: String(source.name || "").trim(),
    provider: source.provider,
    baseURL: String(source.baseURL || "").trim(),
    apiKey: String(source.apiKey || "").trim(),
    model: String(source.model || "").trim(),
    useProxy: source.useProxy ?? false,
  };
  return next;
}

function buildChatModelPayload(draft: ModelEditorState): ChatModelConfig {
  return {
    name: draft.name,
    provider: (draft.provider || "OpenAI") as ChatModelConfig["provider"],
    baseURL: draft.baseURL,
    apiKey: draft.apiKey,
    model: draft.model,
  };
}

function buildImageModelPayload(draft: ModelEditorState): ImageModelConfig {
  return {
    name: draft.name,
    apiKey: draft.apiKey,
    model: draft.model,
    provider: (draft.provider || "OpenAI") as ImageModelConfig["provider"],
    baseURL: draft.baseURL,
  };
}

function buildVideoModelPayload(draft: ModelEditorState): VideoModelConfig {
  return {
    name: draft.name,
    apiKey: draft.apiKey,
    model: draft.model,
    provider: (draft.provider || "DashScope") as VideoModelConfig["provider"],
    baseURL: draft.baseURL,
    useProxy: draft.useProxy ?? false,
  };
}

function createModelPayload(): ModelConfig {
  const draft = normalizeModelDraft();
  if (isVideoModel.value) return buildVideoModelPayload(draft);
  return isImageModel.value ? buildImageModelPayload(draft) : buildChatModelPayload(draft);
}

function syncFromProps(model?: ModelEditorInput) {
  // Sync external selection changes into local edit state without immediately re-emitting.
  const legacyModel = model || {};
  isSyncingFromProps = true;
  Object.assign(
    localModel,
    normalizeModelDraft({
      ...createEmptyModelEditorState(),
      ...legacyModel,
      provider: legacyModel.provider || legacyModel.apiType || "",
    }),
  );
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
    .catch((err) => {
      console.error("Failed to copy API key:", err);
      dsAlert({ type: "error", message: t("toast.copyApiKeyFailed", { error: String(err) }) });
    });
}

watch(
  () => props.model,
  (newModel) => syncFromProps(newModel),
  { deep: true, immediate: true },
);

watch(
  () => [localModel.provider, localModel.model],
  () => {
    if (isSyncingFromProps || isImageModel.value || isVideoModel.value) return;
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
  border: 1px solid oklch(var(--bc) / 0.08);
  border-radius: 14px;
  background: oklch(var(--b1));
  padding: 18px;
}

.model-form-section {
  min-width: 0;
}

.model-connection-section {
  padding-right: 0;
}

.model-form-section + .model-form-section {
  margin-top: 22px;
  padding-top: 20px;
  border-top: 1px solid oklch(var(--bc) / 0.08);
}

.model-section-head {
  max-width: 760px;
  margin-bottom: 12px;

  h4 {
    font-size: 13px;
    line-height: 1.35;
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
  gap: 16px 18px;
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
    line-height: 1.3;
    color: oklch(var(--bc) / 0.74);
  }

  small {
    font-size: 11px;
    line-height: 1.5;
    color: oklch(var(--bc) / 0.62);
  }
}

.model-select {
  width: 100%;
  min-height: 46px;
  padding: 0 38px 0 14px;
  border-radius: 12px;
  border: 1px solid oklch(var(--bc) / 0.1);
  background: oklch(var(--b1) / 0.98)
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M4 6L8 10L12 6' stroke='currentColor' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")
    no-repeat right 12px center / 12px 12px;
  color: oklch(var(--bc));
  appearance: none;

  &:hover {
    border-color: oklch(var(--bc) / 0.18);
  }

  &:focus {
    outline: none;
    border-color: oklch(var(--p) / 0.42);
  }
}

.model-form-field-span {
  grid-column: 1 / -1;
}

.model-proxy-toggle {
  cursor: pointer;
}

.proxy-toggle-row {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.model-key-input {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 46px;
  background: oklch(var(--b1) / 0.96);
  border-radius: 12px;

  input {
    flex: 1;
    min-width: 0;
  }

  :deep(.btn) {
    border-radius: 8px;
    box-shadow: none;
  }
}

.model-capability-toggle {
  min-height: 46px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid oklch(var(--bc) / 0.08);
  background: oklch(var(--b2) / 0.42);

  .model-capability-indicator {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    border: 1px solid oklch(var(--bc) / 0.32);

    &.active {
      border-color: oklch(var(--p) / 0.32);
      background: oklch(var(--p));
    }
  }

  .model-capability-label {
    min-width: 0;
    font-size: 12px;
    font-weight: 700;
    color: oklch(var(--bc));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    justify-self: end;
    border-radius: 8px;
    padding: 3px 8px;
    background: oklch(var(--b1) / 0.82);
    font-size: 11px;
    color: oklch(var(--bc) / 0.62);
    white-space: nowrap;
  }

  &.disabled {
    background: transparent;

    .model-capability-label,
    small {
      opacity: 0.56;
    }
  }
}

@media (max-width: 900px) {
  .model-form-grid,
  .model-capability-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .model-form-card {
    border-radius: 14px;
    padding: 16px;
  }

  .model-section-head {
    margin-bottom: 14px;

    h4 {
      font-size: 15px;
    }

    p {
      font-size: 12px;
      line-height: 1.6;
    }
  }

  .model-form-grid,
  .model-capability-grid {
    gap: 14px;
  }

  .model-form-field {
    gap: 8px;

    span,
    label {
      font-size: 12px;
    }

    small {
      font-size: 11px;
      line-height: 1.55;
    }
  }

  .model-select {
    min-height: 44px;
    padding-left: 14px;
  }

  .model-key-input {
    min-height: 50px;
  }

  .model-capability-toggle {
    min-height: 48px;
    padding: 12px;

    .model-capability-label {
      font-size: 12px;
    }

    small {
      font-size: 11px;
    }
  }
}

@media (max-width: 480px) {
  .model-form-card {
    padding: 14px;
  }

  .model-capability-toggle {
    grid-template-columns: auto minmax(0, 1fr);

    small {
      grid-column: 2;
      justify-self: start;
    }
  }
}
</style>
