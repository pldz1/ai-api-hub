<template>
  <div class="settings-page">
    <aside class="settings-sidebar">
      <header class="settings-sidebar-header">
        <h2>{{ t("user.app.title") }}</h2>
      </header>

      <section v-for="group in settingGroups" :key="group.key" class="settings-nav-group">
        <h3>{{ group.label }}</h3>
        <button
          v-for="item in group.items"
          :key="item.key"
          class="settings-tab-button"
          :class="{ active: activeTab === item.key }"
          @click="activeTab = item.key"
        >
          <span>{{ item.label }}</span>
          <small>{{ item.description }}</small>
        </button>
      </section>
    </aside>

    <main class="settings-main">
      <header class="settings-main-header">
        <p>{{ activeTabInfo.description }}</p>
        <div class="settings-status" :class="statusClass">
          <span class="settings-status-dot"></span>
          <span>{{ statusLabel }}</span>
        </div>
      </header>

      <section class="settings-main-content">
        <TemplatePanel v-if="activeTab === 'chat-templates'" :templates="typedDraftTemplates" @update:templates="updateDraftTemplates" />

        <ModelPanel
          v-else-if="activeTab === 'chat-models'"
          kind="chat"
          :models="draftModels.chat"
          @update:models="updateChatModels"
        />

        <ModelPanel
          v-else-if="activeTab === 'image-generation-models'"
          kind="image"
          operation="generation"
          title-key="user.imageGenerationModels.title"
          description-key="user.imageGenerationModels.description"
          :models="draftModels.imageGeneration"
          @update:models="updateImageGenerationModels"
        />

        <ModelPanel
          v-else-if="activeTab === 'image-edit-models'"
          kind="image"
          operation="edit"
          title-key="user.imageEditModels.title"
          description-key="user.imageEditModels.description"
          :models="draftModels.imageEdit"
          @update:models="updateImageEditModels"
        />

        <AppSettingsPanel v-else @export-settings="exportSettings" @import-settings="importSettings" />
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useStore } from "vuex";
import AppSettingsPanel from "./AppSettingsPanel.vue";
import ModelPanel from "./ModelPanel.vue";
import TemplatePanel from "./TemplatePanel.vue";
import { buildPersistedModelSettingsPayload, migratePersistedModelSettings } from "@/models";
import { exportChatSessionSettings, getChatInsTemplateList, getModels, importChatSessionSettings, setChatInsTemplateList, setModels } from "@/services";
import { dsAlert, getSettingsImportValidationError, isSettingsImportPackage, isValidSettingsImport, uploadJsonFile } from "@/utils";
import type { ChatModelConfig } from "@/types/chat";
import type { ImageModelConfig } from "@/types/image";
import type { ModelSettings, PersistedModelSettingsPayload, SettingsImportPayload } from "@/types/settings";

type SettingTabKey = "chat-templates" | "chat-models" | "image-generation-models" | "image-edit-models" | "app";
type SettingTabItem = { key: SettingTabKey; label: string; description: string };
type SettingTabGroup = { key: string; label: string; items: SettingTabItem[] };
type ChatInstructionTemplate = { id: string; name: string; value: string };
type SettingsAutosaveState = "saved" | "dirty" | "saving" | "error";

interface SettingsDraftPayload {
  models: ModelSettings;
  templates: unknown[];
}

interface UseSettingsDraftOptions {
  autosaveDelay?: number;
  getInitialDraft: () => SettingsDraftPayload;
  persistDraft: (draft: SettingsDraftPayload) => Promise<boolean>;
}

interface UploadedJsonParseError {
  __jsonParseError: string;
}

function createEmptyModelSettings(): ModelSettings {
  return { chat: [], imageGeneration: [], imageEdit: [], image: [] };
}

function clonePlainData<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

function normalizeDraftPayload(payload: Partial<SettingsDraftPayload> | null | undefined = {}): SettingsDraftPayload {
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
  const autosaveDelay = options.autosaveDelay ?? 500;
  const draftModels = ref<ModelSettings>(createEmptyModelSettings());
  const draftTemplates = ref<unknown[]>([]);
  const autosaveState = ref<SettingsAutosaveState>("saved");
  const lastSavedSnapshot = ref("");
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

  const hasUnsavedChanges = computed(() => getDraftSnapshot() !== lastSavedSnapshot.value);
  const shouldBlockUnload = computed(() => autosaveState.value === "saving" || hasUnsavedChanges.value);

  function syncDraftFromSource(payload: Partial<SettingsDraftPayload> | null | undefined = options.getInitialDraft()) {
    isHydrating = true;
    const normalizedPayload = normalizeDraftPayload(payload);
    draftModels.value = normalizedPayload.models;
    draftTemplates.value = normalizedPayload.templates;
    lastSavedSnapshot.value = serializeDraftPayload(normalizedPayload);
    autosaveState.value = "saved";
    isHydrating = false;
  }

  async function persistCurrentDraft(): Promise<boolean> {
    if (isHydrating || isPersisting) return false;
    if (!hasUnsavedChanges.value) {
      autosaveState.value = "saved";
      return true;
    }

    const nextDraft = getDraftPayload();
    isPersisting = true;
    autosaveState.value = "saving";

    try {
      const persisted = await options.persistDraft(nextDraft);
      if (!persisted) {
        autosaveState.value = "error";
        return false;
      }

      lastSavedSnapshot.value = serializeDraftPayload(nextDraft);
      autosaveState.value = "saved";
      return true;
    } finally {
      isPersisting = false;
    }
  }

  function scheduleAutosave() {
    if (isHydrating || isPersisting) return;
    if (!hasUnsavedChanges.value) {
      autosaveState.value = "saved";
      return;
    }

    autosaveState.value = "dirty";
    if (autosaveTimer) window.clearTimeout(autosaveTimer);
    autosaveTimer = window.setTimeout(() => {
      persistCurrentDraft();
    }, autosaveDelay);
  }

  watch(
    [draftModels, draftTemplates],
    () => {
      scheduleAutosave();
    },
    { deep: true },
  );

  onBeforeUnmount(() => {
    if (autosaveTimer) window.clearTimeout(autosaveTimer);
  });

  syncDraftFromSource();

  return {
    autosaveState,
    draftModels,
    draftTemplates,
    shouldBlockUnload,
    getDraftPayload,
    syncDraftFromSource,
  };
}

const store = useStore();
const { t } = useI18n();
const activeTab = ref<SettingTabKey>("chat-models");

const settingGroups = computed<SettingTabGroup[]>(() => [
  {
    key: "chat",
    label: t("user.groups.chat"),
    items: [
      { key: "chat-templates", label: t("user.tabs.templates.label"), description: t("user.tabs.templates.description") },
      { key: "chat-models", label: t("user.tabs.chatModels.label"), description: t("user.tabs.chatModels.description") },
    ],
  },
  {
    key: "image",
    label: t("user.groups.image"),
    items: [
      { key: "image-generation-models", label: t("user.tabs.imageGeneration.label"), description: t("user.tabs.imageGeneration.description") },
      { key: "image-edit-models", label: t("user.tabs.imageEdit.label"), description: t("user.tabs.imageEdit.description") },
    ],
  },
  {
    key: "app",
    label: t("user.groups.app"),
    items: [{ key: "app", label: t("user.tabs.app.label"), description: t("user.tabs.app.description") }],
  },
]);

const { autosaveState, draftModels, draftTemplates, shouldBlockUnload, getDraftPayload, syncDraftFromSource } = useSettingsDraft({
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
const activeTabInfo = computed(() => settingGroups.value.flatMap((group) => group.items).find((item) => item.key === activeTab.value) || settingGroups.value[0].items[0]);
const statusLabel = computed(() => {
  if (autosaveState.value === "saving") return t("common.saving");
  if (autosaveState.value === "error") return t("common.saveError");
  if (autosaveState.value === "dirty") return t("common.autosavePending");
  return t("common.saved");
});
const statusClass = computed(() => ({
  dirty: autosaveState.value === "dirty",
  saving: autosaveState.value === "saving",
  error: autosaveState.value === "error",
}));

function isUploadedJsonParseError(data: unknown): data is UploadedJsonParseError {
  return Boolean(data) && typeof data === "object" && "__jsonParseError" in data;
}

function updateDraftTemplates(nextTemplates: ChatInstructionTemplate[]) {
  draftTemplates.value = nextTemplates;
}

function updateChatModels(nextModels: ChatModelConfig[]) {
  draftModels.value = { ...draftModels.value, chat: nextModels };
}

function updateImageGenerationModels(nextModels: ImageModelConfig[]) {
  draftModels.value = { ...draftModels.value, imageGeneration: nextModels, image: nextModels };
}

function updateImageEditModels(nextModels: ImageModelConfig[]) {
  draftModels.value = { ...draftModels.value, imageEdit: nextModels };
}

function buildSettingsExportFilename(date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `ai-api-hub-setting-${month}-${day}.json`;
}

async function ensureLatestStoreData() {
  await getModels();
  await getChatInsTemplateList();
  syncDraftFromSource({
    models: store.state.models,
    templates: store.state.chatInsTemplateList,
  });
}

async function exportSettings() {
  const draft = getDraftPayload();
  const payload: SettingsImportPayload = {
    schema: "ai-api-hub",
    version: "0.0.1",
    exportedAt: new Date().toISOString(),
    models: buildPersistedModelSettingsPayload(draft.models),
    templates: draft.templates,
    chatSessions: await exportChatSessionSettings(),
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
  const jsonData = await uploadJsonFile();
  if (isUploadedJsonParseError(jsonData)) {
    dsAlert({ type: "error", duration: 6000, message: `${t("user.importReadError")} ${jsonData.__jsonParseError}` });
    return;
  }
  if (!jsonData) {
    dsAlert({ type: "error", message: t("user.importReadError") });
    return;
  }
  if (!isValidSettingsImport(jsonData)) {
    const validationError = getSettingsImportValidationError(jsonData);
    dsAlert({
      duration: 5000,
      type: "error",
      message: validationError ? `${t("user.importInvalid")} ${validationError}` : t("user.importInvalid"),
    });
    return;
  }

  if (isSettingsImportPackage(jsonData)) {
    const importedPackage = clonePlainData(jsonData) as SettingsImportPayload;
    draftModels.value = migratePersistedModelSettings(importedPackage.models);
    if (Array.isArray(importedPackage.templates)) draftTemplates.value = clonePlainData(importedPackage.templates);
    if (Array.isArray(importedPackage.chatSessions)) await importChatSessionSettings(importedPackage.chatSessions);
  } else {
    draftModels.value = migratePersistedModelSettings(clonePlainData(jsonData) as PersistedModelSettingsPayload);
  }

  dsAlert({ type: "success", message: t("user.importSuccess") });
}

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (!shouldBlockUnload.value) return;
  event.preventDefault();
  event.returnValue = "";
}

onMounted(async () => {
  await ensureLatestStoreData();
  window.addEventListener("beforeunload", handleBeforeUnload);
});

onBeforeUnmount(() => {
  window.removeEventListener("beforeunload", handleBeforeUnload);
});
</script>

<style lang="scss" scoped>
.settings-page {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.settings-sidebar {
  padding: 24px 16px;
  border-right: 1px solid rgba(17, 24, 39, 0.06);
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(22px);
  overflow-y: auto;
}

.settings-sidebar-header {
  margin: 0 4px 22px;

  h2 {
    margin: 0;
    color: #202124;
    font-size: 22px;
    font-weight: 700;
    line-height: 1.2;
  }
}

.settings-nav-group {
  display: flex;
  flex-direction: column;
  gap: 8px;

  & + & {
    margin-top: 18px;
  }

  h3 {
    margin: 0 4px;
    color: #9ca3af;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
}

.settings-tab-button {
  border: 1px solid rgba(17, 24, 39, 0.06);
  border-radius: 16px;
  padding: 12px 14px;
  text-align: left;
  background: rgba(255, 255, 255, 0.84);
  box-shadow: 0 8px 24px rgba(31, 41, 55, 0.04);

  span,
  small {
    display: block;
  }

  span {
    font-size: 14px;
    font-weight: 600;
    color: #202124;
  }

  small {
    margin-top: 4px;
    font-size: 11px;
    line-height: 1.4;
    color: #5f6368;
  }

  &:hover,
  &.active {
    border-color: rgba(35, 95, 143, 0.14);
    background: #eef6ff;
  }
}

.settings-main {
  min-width: 0;
  padding: 20px 22px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: hidden;
}

.settings-main-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 18px;

  p {
    max-width: 36rem;
    font-size: 13px;
    line-height: 1.65;
    color: #5f6368;
  }
}

.settings-status {
  border-radius: 999px;
  padding: 7px 12px;
  background-color: rgba(255, 255, 255, 0.9);
  font-size: 12px;
  color: #5f6368;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(17, 24, 39, 0.06);

  .settings-status-dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background-color: rgba(95, 99, 104, 0.65);
  }

  &.dirty {
    background-color: #fff7e8;
    color: #6b4f1d;

    .settings-status-dot {
      background-color: #d97706;
    }
  }

  &.saving {
    background-color: #eef6ff;
    color: #174466;

    .settings-status-dot {
      background-color: #2563eb;
    }
  }

  &.error {
    background-color: #fff0f3;
    color: #9f1239;

    .settings-status-dot {
      background-color: #be123c;
    }
  }
}

.settings-main-content {
  min-height: 0;
  flex: 1;
  overflow: hidden;
  border: 1px solid rgba(17, 24, 39, 0.07);
  border-radius: 26px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow:
    0 2px 6px rgba(17, 24, 39, 0.05),
    0 4px 8px rgba(17, 24, 39, 0.06);
  padding: 20px;
}

@media (max-width: 1100px) {
  .settings-page {
    grid-template-columns: 1fr;
  }

  .settings-sidebar {
    border-right: none;
    border-bottom: 1px solid rgba(17, 24, 39, 0.06);
  }

  .settings-main-header {
    flex-direction: column;
  }
}
</style>
