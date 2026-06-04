<template>
  <div class="settings-page">
    <main class="settings-main">
      <section class="settings-main-content" :class="{ 'is-model-settings': activeTab === 'chat-models' || activeTab === 'image-models' || activeTab === 'video-models' }">
        <!-- Chat instruction templates -->
        <TemplatePanel v-if="activeTab === 'chat-templates'" :templates="typedDraftTemplates" @update:templates="updateDraftTemplates" />

        <!-- Chat model registry -->
        <ModelPanel v-else-if="activeTab === 'chat-models'" kind="chat" :models="draftModels.chat" @update:models="updateChatModels" />

        <!-- Image model registry -->
        <ModelPanel v-else-if="activeTab === 'image-models'" kind="image" :models="draftModels.image" @update:models="updateImageModels" />

        <!-- Video model registry -->
        <ModelPanel v-else-if="activeTab === 'video-models'" kind="video" :models="draftModels.video" @update:models="updateVideoModels" />

        <!-- App-level import/export tools -->
        <AppPanel v-else @export-settings="exportSettings" @import-settings="importSettings" />
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useStore } from "vuex";
import AppPanel from "./AppPanel.vue";
import ModelPanel from "./ModelPanel.vue";
import TemplatePanel from "./TemplatePanel.vue";
import { buildModelSettings } from "@/models";
import { SETTINGS_IMPORTED_EVENT, getChatInsTemplateList, getModels, importSettingsFromUploadedJsonFile, setChatInsTemplateList, setModels } from "@/services";
import { dsAlert } from "@/utils";
import { APP_NAME, APP_VERSION } from "@/constants";
type SettingTabKey_S = "chat-templates" | "chat-models" | "image-models" | "video-models" | "app";
import type { ChatModelConfig, ImageModelConfig, VideoModelConfig, ModelSettings, SettingsImportPayload } from "@/types";

type ChatInstructionTemplate = { id: string; name: string; value: string };

interface SettingsDraftPayload {
  models: ModelSettings;
  templates: unknown[];
}

interface UseSettingsDraftOptions {
  autosaveDelay?: number;
  getInitialDraft: () => SettingsDraftPayload;
  persistDraft: (draft: SettingsDraftPayload) => Promise<boolean>;
}

function createEmptyModelSettings(): ModelSettings {
  return { chat: [], image: [], video: [] };
}

function clonePlainData<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

function normalizeDraftPayload(payload: Partial<SettingsDraftPayload> | null | undefined = {}): SettingsDraftPayload {
  // Normalize older or partial settings payloads before they enter the editable draft.
  return {
    models: {
      ...createEmptyModelSettings(),
      ...clonePlainData(payload?.models || createEmptyModelSettings()),
    },
    templates: clonePlainData(payload?.templates || []),
  };
}

function serializeDraftPayload(payload: SettingsDraftPayload): string {
  return JSON.stringify({
    models: payload.models,
    templates: payload.templates,
  });
}

function useSettingsDraft(options: UseSettingsDraftOptions) {
  // 💾 Local draft state lets the UI autosave without mutating persisted data mid-edit.
  const autosaveDelay = options.autosaveDelay ?? 500;
  const draftModels = ref<ModelSettings>(createEmptyModelSettings());
  const draftTemplates = ref<unknown[]>([]);
  const lastSavedSnapshot = ref("");
  const currentDraftSnapshot = ref("");
  let autosaveTimer: number | null = null;
  let isHydrating = false;
  let isPersisting = false;

  function getDraftPayload(): SettingsDraftPayload {
    return {
      models: clonePlainData(draftModels.value),
      templates: clonePlainData(draftTemplates.value),
    };
  }

  function getDraftSnapshot(): string {
    return serializeDraftPayload(getDraftPayload());
  }

  const hasUnsavedChanges = computed(() => currentDraftSnapshot.value !== lastSavedSnapshot.value);
  const shouldBlockUnload = computed(() => hasUnsavedChanges.value);

  function syncDraftFromSource(payload: Partial<SettingsDraftPayload> | null | undefined = options.getInitialDraft()) {
    // Hydration resets the save baseline so initial store data is not treated as dirty.
    isHydrating = true;
    const normalizedPayload = normalizeDraftPayload(payload);
    draftModels.value = normalizedPayload.models;
    draftTemplates.value = normalizedPayload.templates;
    currentDraftSnapshot.value = serializeDraftPayload(normalizedPayload);
    lastSavedSnapshot.value = currentDraftSnapshot.value;
    isHydrating = false;
  }

  async function persistCurrentDraft(): Promise<boolean> {
    // Ignore overlapping save cycles; the watcher will schedule another pass after edits.
    if (isHydrating || isPersisting) return false;
    if (!hasUnsavedChanges.value) {
      return true;
    }

    const nextDraft = getDraftPayload();
    isPersisting = true;

    try {
      const persisted = await options.persistDraft(nextDraft);
      if (!persisted) {
        return false;
      }

      lastSavedSnapshot.value = serializeDraftPayload(nextDraft);
      return true;
    } finally {
      isPersisting = false;
      currentDraftSnapshot.value = getDraftSnapshot();
      if (!isHydrating && currentDraftSnapshot.value !== lastSavedSnapshot.value) scheduleAutosave();
    }
  }

  function scheduleAutosave() {
    // Debounce draft changes so rapid field edits produce a single persistence write.
    if (isHydrating || isPersisting) return;
    currentDraftSnapshot.value = getDraftSnapshot();
    if (!hasUnsavedChanges.value) {
      return;
    }

    if (autosaveTimer) window.clearTimeout(autosaveTimer);
    autosaveTimer = window.setTimeout(() => {
      persistCurrentDraft();
    }, autosaveDelay);
  }

  watch([draftModels, draftTemplates], () => {
    scheduleAutosave();
  });

  onBeforeUnmount(() => {
    if (autosaveTimer) window.clearTimeout(autosaveTimer);
  });

  syncDraftFromSource();

  return {
    draftModels,
    draftTemplates,
    shouldBlockUnload,
    getDraftPayload,
    syncDraftFromSource,
  };
}

const props = defineProps<{
  activeTab: SettingTabKey_S;
}>();

defineEmits<{
  "update:activeTab": [key: SettingTabKey_S];
}>();

const store = useStore();
const { t } = useI18n();
const activeTab = computed(() => props.activeTab);

const { draftModels, draftTemplates, shouldBlockUnload, getDraftPayload, syncDraftFromSource } = useSettingsDraft({
  getInitialDraft: () => ({
    models: store.state.models,
    templates: store.state.chatInsTemplateList,
  }),
  persistDraft: async (draft) => {
    await store.dispatch("setModels", draft.models);
    await store.dispatch("setChatInsTemplateList", draft.templates);

    const modelsSaved = await setModels(draft.models);
    const templatesSaved = await setChatInsTemplateList(draft.templates);
    return modelsSaved !== false && templatesSaved !== false;
  },
});

const typedDraftTemplates = computed<ChatInstructionTemplate[]>(() => draftTemplates.value as ChatInstructionTemplate[]);

function updateDraftTemplates(nextTemplates: ChatInstructionTemplate[]) {
  draftTemplates.value = nextTemplates;
}

function updateChatModels(nextModels: ChatModelConfig[]) {
  draftModels.value = { ...draftModels.value, chat: nextModels };
}

function updateImageModels(nextModels: ImageModelConfig[]) {
  draftModels.value = { ...draftModels.value, image: nextModels };
}

function updateVideoModels(nextModels: VideoModelConfig[]) {
  draftModels.value = { ...draftModels.value, video: nextModels };
}

function buildSettingsExportFilename(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `ai-api-hub-setting-${month}-${day}.json`;
}

async function ensureLatestStoreData() {
  // Refresh persisted settings before editing so the draft starts from the newest source.
  await getModels();
  await getChatInsTemplateList();
  syncDraftFromSource({
    models: store.state.models,
    templates: store.state.chatInsTemplateList,
  });
}

async function exportSettings() {
  // 📦 Export models, templates, and chat sessions into one portable settings package.
  const draft = getDraftPayload();
  const payload: SettingsImportPayload = {
    schema: APP_NAME,
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    models: buildModelSettings(draft.models),
    templates: draft.templates,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = buildSettingsExportFilename();
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  dsAlert({ type: "success", message: t("user.exportSuccess") });
}

async function importSettings() {
  if (!(await importSettingsFromUploadedJsonFile())) return;
  syncDraftFromSource({
    models: store.state.models,
    templates: store.state.chatInsTemplateList,
  });
}

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (!shouldBlockUnload.value) return;
  event.preventDefault();
  event.returnValue = "";
}

onMounted(async () => {
  await ensureLatestStoreData();
  window.addEventListener("beforeunload", handleBeforeUnload);
  window.addEventListener(SETTINGS_IMPORTED_EVENT, ensureLatestStoreData);
});

onBeforeUnmount(() => {
  window.removeEventListener("beforeunload", handleBeforeUnload);
  window.removeEventListener(SETTINGS_IMPORTED_EVENT, ensureLatestStoreData);
});
</script>

<style lang="scss" scoped>
.settings-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.settings-main {
  width: min(100%, 1080px);
  min-width: 0;
  min-height: 0;
  flex: 1;
  margin-inline: auto;
  padding: 20px 22px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: hidden;
}

.settings-main-content {
  width: 100%;
  min-height: 0;
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  scrollbar-gutter: stable;
  border: 1px solid oklch(var(--bc) / 0.07);
  border-radius: 26px;
  background: oklch(var(--b1) / 0.9);
  box-shadow:
    0 2px 6px oklch(var(--bc) / 0.05),
    0 4px 8px oklch(var(--bc) / 0.06);
  padding: 20px;
  contain: layout paint style;
}

.settings-main-content.is-model-settings {
  width: min(100%, 1180px);
  align-self: center;
}

@media (max-width: 720px) {
  .settings-main {
    padding: 14px 14px 16px;
    gap: 14px;
    flex: 1 1 auto;
  }

  .settings-main-content {
    border-radius: 22px;
    padding: 18px 18px 32px;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
}
</style>
