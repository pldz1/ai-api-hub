<template>
  <div class="model-form-card" :class="{ 'image-model-form': isImageModel }">
    <div class="model-form-header">
      <div>
        <h3>{{ t(cardTitleKey) }}</h3>
        <p>{{ t(cardSubtitleKey) }}</p>
        <div v-if="isImageModel" class="model-capability-row">
          <span>{{ activeProtocolLabel }}</span>
          <span>{{ hasImageInputParam ? t("user.modelCard.imageInputEnabled") : t("user.modelCard.imageInputDisabled") }}</span>
          <span>{{ activeParamDefs.length }} {{ t("user.modelCard.paramCountSuffix") }}</span>
        </div>
      </div>
      <div v-if="props.modelKind === 'chat' && localModel.modelType" class="model-behavior-chip">
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

        <div class="model-form-field">
          <label>{{ t("user.modelCard.fields.apiType") }}</label>
          <select class="select select-bordered w-full" v-model="localModel.apiType">
            <option v-for="ai in availableApiTypeList" :key="ai.value" :value="ai.value">
              {{ ai.name }}
            </option>
          </select>
        </div>

        <div v-if="!isImageModel" class="model-form-field model-form-field-span">
          <label>{{ t("user.modelCard.fields.model") }}</label>
          <select class="select select-bordered w-full" v-model="localModel.modelType">
            <option v-for="item in visibleModelSuggestions" :key="item.value" :value="item.value">
              {{ item.name }}
            </option>
          </select>
          <div class="model-field-help">
            {{ t("user.modelCard.chatModelHelp") }}
          </div>
        </div>

        <div v-if="isImageModel && !isAzure" class="model-form-field model-form-field-span">
          <label>{{ t("user.modelCard.fields.modelOverride") }}</label>
          <input type="text" class="input input-bordered w-full" :placeholder="modelTypePlaceholder" v-model.trim="localModel.modelType" />
          <div class="model-field-help">
            {{ t("user.modelCard.imageModelHelp") }}
          </div>
          <div class="model-suggestion-list">
            <button
              v-for="item in visibleModelSuggestions"
              :key="item.value"
              type="button"
              class="btn btn-sm"
              :class="localModel.modelType === item.value ? 'btn-neutral' : 'btn-outline'"
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
        <h4>Capabilities</h4>
        <p>Built-in model capabilities. Image is persistent input support; Thinking and Web are optional per-message actions.</p>
      </div>

      <div class="model-capability-grid">
        <div v-for="item in chatCapabilityRows" :key="item.key" class="model-capability-toggle" :class="{ disabled: !item.supported }">
          <span class="model-capability-indicator" :class="{ active: item.supported }"></span>
          <span>{{ item.label }}</span>
          <small>{{ item.supported ? "Supported" : "Unsupported" }}</small>
        </div>
      </div>
    </section>

    <section v-if="isParamConfigurable" class="model-form-section model-form-section-accent">
      <div class="model-section-head">
        <h4>{{ isImageModel ? t("user.modelCard.sections.imageParamsTitle") : t("user.modelCard.sections.chatParamsTitle") }}</h4>
        <p>{{ isImageModel ? t("user.modelCard.sections.imageParamsDescription") : t("user.modelCard.sections.chatParamsDescription") }}</p>
      </div>

      <div class="model-form-field model-form-field-span">
        <label>{{ isImageModel ? t("user.modelCard.fields.imageParameters") : t("user.modelCard.fields.chatParameters") }}</label>
        <div class="model-field-help">
          {{ isImageModel ? t("user.modelCard.imageParamsHelp") : t("user.modelCard.chatParamsHelp") }}
        </div>

        <div class="model-suggestion-list">
          <button v-for="item in availableParamPresets" :key="item.key" type="button" class="btn btn-sm btn-outline" @click="addParamDef(item.key)">
            + {{ item.label }}
          </button>
          <button type="button" class="btn btn-sm btn-outline" @click="addParamDef()">+ {{ t("user.modelCard.addCustomParam") }}</button>
        </div>

        <div v-if="activeParamDefs.length > 0" class="param-toolbar">
          <button type="button" class="btn btn-sm btn-outline" @click="expandAllParams">
            {{ t("user.modelCard.expandAllParams") }}
          </button>
          <button type="button" class="btn btn-sm btn-outline" @click="collapseAllParams">
            {{ t("user.modelCard.collapseAllParams") }}
          </button>
        </div>

        <div v-if="activeParamDefs.length === 0" class="model-info-card">
          {{ isImageModel ? t("user.modelCard.noImageParams") : t("user.modelCard.noChatParams") }}
        </div>

        <div v-else class="param-definition-list">
          <div
            v-for="(item, index) in activeParamDefs"
            :key="getParamUiKey(item, index)"
            class="param-definition-card"
            :class="{ collapsed: !isParamExpanded(item, index) }"
          >
            <div class="param-definition-summary">
              <div class="param-definition-summary-main">
                <div class="param-definition-summary-title">
                  {{ item.label || item.key || t("user.modelCard.untitledParam") }}
                </div>
                <div class="param-definition-summary-meta">
                  <span>{{ item.key || t("user.modelCard.fields.key") }}</span>
                  <span class="param-type-chip">{{ item.type }}</span>
                </div>
              </div>
              <button type="button" class="btn btn-sm btn-ghost" @click="toggleParamExpanded(item, index)">
                {{ isParamExpanded(item, index) ? t("user.modelCard.collapseParam") : t("user.modelCard.expandParam") }}
              </button>
            </div>

            <div v-show="isParamExpanded(item, index)" class="param-definition-body">
              <div class="param-definition-grid">
                <div class="model-form-field">
                  <label>{{ t("user.modelCard.fields.key") }}</label>
                  <input type="text" class="input input-bordered w-full" v-model.trim="item.key" :placeholder="t('user.modelCard.placeholders.paramKey')" />
                </div>

                <div class="model-form-field">
                  <label>{{ t("user.modelCard.fields.type") }}</label>
                  <select class="select select-bordered w-full" v-model="item.type">
                    <option v-for="typeItem in activeParamTypeList" :key="typeItem.value" :value="typeItem.value">
                      {{ typeItem.name }}
                    </option>
                  </select>
                </div>

                <div class="model-form-field model-form-field-span">
                  <label>{{ t("user.modelCard.fields.label") }}</label>
                  <input type="text" class="input input-bordered w-full" v-model.trim="item.label" :placeholder="t('user.modelCard.placeholders.paramLabel')" />
                </div>

                <div class="model-form-field model-form-field-span">
                  <label>{{ t("user.modelCard.fields.description") }}</label>
                  <input
                    type="text"
                    class="input input-bordered w-full"
                    v-model.trim="item.description"
                    :placeholder="t('user.modelCard.placeholders.paramDescription')"
                  />
                </div>

                <div class="model-form-field model-form-field-span">
                  <label>{{ t("user.modelCard.fields.defaultValue") }}</label>
                  <input v-if="item.type === 'number'" type="number" class="input input-bordered w-full" v-model.number="item.defaultValue" />
                  <input
                    v-else-if="item.type === 'string'"
                    type="text"
                    class="input input-bordered w-full"
                    v-model="item.defaultValue"
                    :placeholder="item.placeholder || t('user.modelCard.placeholders.defaultValue')"
                  />
                  <input v-else-if="item.type === 'boolean'" type="checkbox" class="toggle toggle-primary" v-model="item.defaultValue" />
                  <textarea
                    v-else-if="item.type === 'array' || item.type === 'object'"
                    class="textarea textarea-bordered w-full"
                    :value="formatJsonParamValue(item.defaultValue, item.type)"
                    :placeholder="getJsonPlaceholder(item)"
                    @input="updateJsonParamDefault(index, ($event.target as HTMLTextAreaElement).value)"
                  ></textarea>
                  <div v-else-if="item.type === 'image'" class="model-info-card">
                    {{ t("user.modelCard.imageParamDefaultHelp") }}
                  </div>
                </div>

                <template v-if="item.type === 'number'">
                  <div class="model-form-field">
                    <label>{{ t("user.modelCard.fields.min") }}</label>
                    <input type="number" class="input input-bordered w-full" v-model.number="item.min" />
                  </div>

                  <div class="model-form-field">
                    <label>{{ t("user.modelCard.fields.max") }}</label>
                    <input type="number" class="input input-bordered w-full" v-model.number="item.max" />
                  </div>

                  <div class="model-form-field">
                    <label>{{ t("user.modelCard.fields.step") }}</label>
                    <input type="number" class="input input-bordered w-full" v-model.number="item.step" />
                  </div>
                </template>

                <div v-if="item.type !== 'number'" class="model-form-field model-form-field-span">
                  <label>{{ t("user.modelCard.fields.placeholder") }}</label>
                  <input
                    type="text"
                    class="input input-bordered w-full"
                    v-model.trim="item.placeholder"
                    :placeholder="t('user.modelCard.placeholders.inputHint')"
                  />
                </div>
              </div>

              <div class="param-definition-actions">
                <button type="button" class="btn btn-sm btn-outline btn-error" @click="removeChatParamDef(index)">
                  {{ t("user.modelCard.removeParam") }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { dsAlert } from "@/utils";
import copyIcon from "@/assets/svg/copy16.svg";
import SvgIcon from "@/components/base/SvgIcon.vue";
import type { ImageOperation, ModelConfig, ModelDraftConfig, ModelKind, ModelParamDef, SelectOption } from "@/types/model";
import {
  defModelType,
  apiTypeList,
  capabilityLabels,
  chatDisplayedCapabilityKeys,
  imageApiTypeList,
  chatParamPresetList,
  chatParamTypeList,
  imageParamTypeList,
  imageParamPresetList,
  getChatModelInfo,
  getChatModelCapabilities,
  getModelChatParamDefs,
  getModelImageParamDefs,
  getModelRequestId,
  isChatParamSupportedForModel,
  normalizeChatModelConfig,
  normalizeChatParamDef,
  normalizeImageModelConfig,
  normalizeImageParamDef,
  parseChatParamValue,
} from "@/constants";

const props = withDefaults(
  defineProps<{
    model?: Partial<ModelDraftConfig>;
    modelSuggestions?: SelectOption[];
    modelKind?: ModelKind;
    imageOperation?: ImageOperation;
  }>(),
  {
    model: () => structuredClone(defModelType),
    modelSuggestions: () => [],
    modelKind: "chat",
    imageOperation: "generation",
  },
);

const emit = defineEmits<{
  "update:model": [model: ModelConfig];
}>();
const { t } = useI18n();
const localModel = reactive<ModelDraftConfig>(structuredClone(defModelType));
const expandedParamKeys = ref<string[]>([]);
let isSyncingFromProps = false;
let lastModelSnapshot = "";

const visibleModelSuggestions = computed(() => props.modelSuggestions);
const availableApiTypeList = computed(() => (isImageModel.value ? imageApiTypeList : apiTypeList));
const activeParamDefs = computed(() => (isImageModel.value ? localModel.imageParamDefs || [] : localModel.chatParamDefs || []));
const activeParamTypeList = computed(() => {
  if (!isImageModel.value) return chatParamTypeList;
  return props.imageOperation === "edit" ? imageParamTypeList : imageParamTypeList.filter((item) => item.value !== "image");
});
const availableParamPresets = computed(() => {
  const existingKeys = new Set(activeParamDefs.value.map((item) => item.key).filter(Boolean));
  const presetList = isImageModel.value ? imageParamPresetList : chatParamPresetList;
  return presetList.filter(
    (item) =>
      !existingKeys.has(item.key) &&
      (isImageModel.value || isChatParamSupportedForModel(item.key, localModel.modelType, localModel.apiType)) &&
      (props.imageOperation === "edit" || item.type !== "image"),
  );
});
const isImageModel = computed(() => props.modelKind === "image");
const isAzure = computed(() => localModel.apiType === "Azure OpenAI");
const isOpenAIStyle = computed(() => localModel.apiType === "OpenAI");
const isParamConfigurable = computed(() => props.modelKind === "chat" || props.modelKind === "image");
const hasImageInputParam = computed(() => isImageModel.value && activeParamDefs.value.some((item) => item.type === "image"));
const activeProtocolLabel = computed(() => (isAzure.value ? "Azure OpenAI" : "OpenAI"));
const modelTypePlaceholder = computed(() => {
  return props.modelKind === "image" ? t("user.modelCard.placeholders.imageModelId") : t("user.modelCard.placeholders.chatModelId");
});
const resolvedModelId = computed(() => getModelRequestId(localModel));
const modelBehaviorHint = computed(() => {
  const modelInfo = getChatModelInfo(localModel.modelType, localModel.apiType);
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
const supportedChatCapabilities = computed(() => getChatModelCapabilities(localModel.modelType, localModel.apiType));
const chatCapabilityRows = computed(() =>
  chatDisplayedCapabilityKeys.map((key) => ({
    key,
    label: capabilityLabels[key],
    supported: supportedChatCapabilities.value[key],
  })),
);

function normalizeModelFields() {
  if (isImageModel.value) {
    localModel.apiType = localModel.apiType === "Azure OpenAI" ? "Azure OpenAI" : "OpenAI";
    localModel.imageOperation = props.imageOperation;
    localModel.modelType = (localModel.modelType || localModel.model || "").trim();
    if (localModel.apiType === "Azure OpenAI") {
      localModel.baseURL = "";
      localModel.model = "";
      return;
    }

    localModel.endpoint = "";
    localModel.deployment = "";
    localModel.apiVersion = "";
    localModel.model = localModel.modelType;
    return;
  }

  if (!localModel.modelType && localModel.model) {
    localModel.modelType = localModel.model.trim();
  }

  if (isAzure.value) {
    localModel.baseURL = "";
    localModel.model = "";
    return;
  }

  if (isOpenAIStyle.value) {
    localModel.endpoint = "";
    localModel.deployment = "";
    localModel.apiVersion = "";
    localModel.model = (localModel.modelType || localModel.model || "").trim();
  }
}

function createModelPayload(): ModelConfig {
  normalizeModelFields();
  if (props.modelKind === "image") {
    return normalizeImageModelConfig(
      {
        ...JSON.parse(JSON.stringify(localModel)),
        imageParamDefs: (localModel.imageParamDefs || []).map((item) => normalizeImageParamDef(item)).filter((item) => item.key),
      },
      props.imageOperation,
    );
  }

  return normalizeChatModelConfig({
    ...JSON.parse(JSON.stringify(localModel)),
    chatParamDefs: (localModel.chatParamDefs || []).map((item) => normalizeChatParamDef(item)).filter((item) => item.key),
  });
}

function syncFromProps(model?: Partial<ModelDraftConfig>) {
  isSyncingFromProps = true;
  Object.assign(localModel, structuredClone(defModelType), model || {});
  localModel.enabledCapabilities = { ...(model?.enabledCapabilities || {}) };
  localModel.chatParamDefs = props.modelKind === "chat" ? getModelChatParamDefs(model || {}) : Array.isArray(model?.chatParamDefs) ? model.chatParamDefs : [];
  localModel.imageParamDefs = props.modelKind === "image" ? getModelImageParamDefs(model || {}) : Array.isArray(model?.imageParamDefs) ? model.imageParamDefs : [];
  normalizeModelFields();
  syncExpandedParamKeys();
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
  localModel.modelType = value;
};

const addParamDef = (presetKey = "") => {
  const normalizeParam = isImageModel.value ? normalizeImageParamDef : normalizeChatParamDef;
  const targetKey = isImageModel.value ? "imageParamDefs" : "chatParamDefs";
  const nextDef = normalizeParam(presetKey ? { key: presetKey } : { key: "", label: "", type: "string", defaultValue: "" });
  const nextDefs = [...(localModel[targetKey] || []), nextDef];
  localModel[targetKey] = nextDefs;
  expandedParamKeys.value = [...new Set([...expandedParamKeys.value, getParamUiKey(nextDef, nextDefs.length - 1)])];
};

const removeChatParamDef = (index: number) => {
  const targetKey = isImageModel.value ? "imageParamDefs" : "chatParamDefs";
  localModel[targetKey] = (localModel[targetKey] || []).filter((_, itemIndex) => itemIndex !== index);
  syncExpandedParamKeys();
};

const getParamUiKey = (item: Partial<ModelParamDef>, index: number) => `${index}:${item?.key || "param"}`;

const syncExpandedParamKeys = () => {
  const currentKeys = activeParamDefs.value.map((item, index) => getParamUiKey(item, index));
  expandedParamKeys.value = expandedParamKeys.value.filter((key) => currentKeys.includes(key));
};

const isParamExpanded = (item: Partial<ModelParamDef>, index: number) => expandedParamKeys.value.includes(getParamUiKey(item, index));

const toggleParamExpanded = (item: Partial<ModelParamDef>, index: number) => {
  const uiKey = getParamUiKey(item, index);
  expandedParamKeys.value = isParamExpanded(item, index) ? expandedParamKeys.value.filter((key) => key !== uiKey) : [...expandedParamKeys.value, uiKey];
};

const expandAllParams = () => {
  expandedParamKeys.value = activeParamDefs.value.map((item, index) => getParamUiKey(item, index));
};

const collapseAllParams = () => {
  expandedParamKeys.value = [];
};

const formatJsonParamValue = (value: unknown, type = "array") => {
  if (type === "array") return Array.isArray(value) ? JSON.stringify(value) : "[]";
  return value && typeof value === "object" && !Array.isArray(value) ? JSON.stringify(value, null, 2) : "{}";
};

const getJsonPlaceholder = (item: Partial<ModelParamDef>) => {
  if (item?.placeholder) return item.placeholder;
  return item?.type === "object" ? t("user.modelCard.placeholders.objectValue") : t("user.modelCard.placeholders.arrayValue");
};

const updateJsonParamDefault = (index: number, rawValue: string) => {
  const targetKey = isImageModel.value ? "imageParamDefs" : "chatParamDefs";
  const nextDefs = [...(localModel[targetKey] || [])];
  const type = nextDefs[index]?.type || "array";
  nextDefs[index] = {
    ...nextDefs[index],
    defaultValue: parseChatParamValue(type, rawValue, type === "object" ? {} : []),
  };
  localModel[targetKey] = nextDefs;
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
  () => [localModel.apiType, localModel.modelType],
  () => {
    if (isSyncingFromProps || isImageModel.value) return;
    localModel.chatParamDefs = getModelChatParamDefs({ apiType: localModel.apiType, modelType: localModel.modelType });
    syncExpandedParamKeys();
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

.model-form-section-accent {
  border-color: oklch(var(--p) / 0.22);
  box-shadow: inset 0 1px 0 oklch(var(--b1) / 0.9);
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

.image-model-form .model-form-section-accent {
  border-color: oklch(var(--su) / 0.18);
  background: linear-gradient(180deg, oklch(var(--b1) / 0.9), oklch(var(--su) / 0.045));
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

.param-definition-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.param-definition-card {
  border: 1px solid oklch(var(--b3) / 0.6);
  border-radius: 14px;
  padding: 12px;
  background: linear-gradient(180deg, oklch(var(--b1) / 0.72), oklch(var(--b2) / 0.52));
  box-shadow: inset 0 1px 0 oklch(var(--b1) / 0.75);
}

.param-definition-card.collapsed {
  padding-bottom: 10px;
}

.param-definition-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px 12px;
}

.param-toolbar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.param-definition-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.param-definition-summary-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.param-definition-summary-title {
  font-size: 13px;
  font-weight: 700;
  color: oklch(var(--bc) / 0.86);
}

.param-definition-summary-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 11px;
  color: oklch(var(--bc) / 0.58);
}

.param-type-chip {
  border-radius: 999px;
  padding: 2px 8px;
  background-color: oklch(var(--n) / 0.08);
  color: oklch(var(--bc) / 0.7);
}

.param-definition-body {
  margin-top: 12px;
}

.param-definition-actions {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
}

.param-definition-card :deep(.input),
.param-definition-card :deep(.select),
.param-definition-card :deep(.textarea) {
  min-height: 42px;
  font-size: 12px;
}

.param-definition-card :deep(.textarea) {
  min-height: 84px;
}

.param-definition-card .model-form-field {
  gap: 5px;
}

.param-definition-card .model-form-field label {
  font-size: 11px;
  font-weight: 600;
  color: oklch(var(--bc) / 0.72);
}

.param-definition-card .btn {
  min-height: 34px;
  font-size: 12px;
  padding-inline: 10px;
}

@media (max-width: 900px) {
  .model-form-grid {
    grid-template-columns: 1fr;
  }

  .model-form-header {
    flex-direction: column;
  }

  .param-definition-grid {
    grid-template-columns: 1fr;
  }
}
</style>
