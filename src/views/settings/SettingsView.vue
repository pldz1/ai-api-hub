<template>
  <div class="settings-page-shell">
    <div class="settings-page">
      <aside class="settings-sidebar">
        <div class="settings-group-list">
          <section v-for="group in settingGroups" :key="group.key" class="settings-nav-group">
            <h3>{{ group.label }}</h3>
            <div class="settings-tab-list">
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
            </div>
          </section>
        </div>
      </aside>

      <main class="settings-main">
        <header class="settings-main-header">
          <div>
            <p class="settings-main-subtitle">{{ activeTabInfo.description }}</p>
          </div>

          <div class="settings-main-actions">
            <div class="settings-status" :class="statusClass">
              <span class="settings-status-dot"></span>
              <span>{{ statusLabel }}</span>
            </div>
          </div>
        </header>

        <section class="settings-main-content">
          <ChatInsTemplateList v-if="activeTab === 'chat-templates'" :templates="draftTemplates" @update:templates="updateDraftTemplates" />

          <ChatModels v-if="activeTab === 'chat-models'" :models="draftModels.chat" @update:models="updateChatModels" />

          <ImageModels
            v-if="activeTab === 'image-generation-models'"
            title-key="user.imageGenerationModels.title"
            description-key="user.imageGenerationModels.description"
            model-operation="generation"
            :models="draftModels.imageGeneration"
            @update:models="updateImageGenerationModels"
          />

          <ImageModels
            v-if="activeTab === 'image-edit-models'"
            title-key="user.imageEditModels.title"
            description-key="user.imageEditModels.description"
            model-operation="edit"
            :models="draftModels.imageEdit"
            @update:models="updateImageEditModels"
          />

          <AppSettings v-if="activeTab === 'app'" @export-settings="exportSettings" @import-settings="importSettings" />
        </section>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useStore } from "vuex";
import { useI18n } from "vue-i18n";
import ChatModels from "@/views/settings/components/ChatModels.vue";
import ImageModels from "@/views/settings/components/ImageModels.vue";
import ChatInsTemplateList from "@/views/settings/components/ChatInsTemplateList.vue";
import AppSettings from "@/views/settings/components/AppSettings.vue";
import { buildPersistedModelSettingsPayload, migratePersistedModelSettings } from "@/models";
import { exportChatSessionSettings, getModels, getChatInsTemplateList, importChatSessionSettings, setModels, setChatInsTemplateList } from "@/services";
import { uploadJsonFile, isValidSettingsImport, getSettingsImportValidationError, isSettingsImportPackage, dsAlert } from "@/utils";
import { useSettingsDraft } from "./useSettingsDraft";
import type { ChatModelConfig } from "@/types/chat";
import type { ImageModelConfig, PersistedModelSettingsPayload, SettingsImportPayload } from "@/types/image";

const store = useStore();
const router = useRouter();
const { t } = useI18n();

const settingGroups = computed(() => [
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

const activeTab = ref("chat-models");

interface UploadedJsonParseError {
  __jsonParseError: string;
}

function clonePlainData<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

function isUploadedJsonParseError(data: unknown): data is UploadedJsonParseError {
  return Boolean(data) && typeof data === "object" && "__jsonParseError" in data;
}

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

const activeTabInfo = computed(() => {
  return settingGroups.value.flatMap((group) => group.items).find((item) => item.key === activeTab.value) || settingGroups.value[0].items[0];
});

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

function updateChatModels(nextModels: ChatModelConfig[]) {
  draftModels.value = {
    ...draftModels.value,
    chat: nextModels,
  };
}

function updateImageGenerationModels(nextModels: ImageModelConfig[]) {
  draftModels.value = {
    ...draftModels.value,
    imageGeneration: nextModels,
    image: nextModels,
  };
}

function updateImageEditModels(nextModels: ImageModelConfig[]) {
  draftModels.value = {
    ...draftModels.value,
    imageEdit: nextModels,
  };
}

function updateDraftTemplates(nextTemplates: unknown[]) {
  draftTemplates.value = nextTemplates;
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
  const chatSessions = await exportChatSessionSettings();
  const payload: SettingsImportPayload = {
    schema: "ai-api-hub",
    version: "0.0.1",
    exportedAt: new Date().toISOString(),
    models: buildPersistedModelSettingsPayload(draft.models),
    templates: draft.templates,
    chatSessions,
  };
  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = buildSettingsExportFilename();
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
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
    if (Array.isArray(importedPackage.templates)) {
      draftTemplates.value = clonePlainData(importedPackage.templates);
    }
    if (Array.isArray(importedPackage.chatSessions)) {
      await importChatSessionSettings(importedPackage.chatSessions);
    }
  } else {
    draftModels.value = migratePersistedModelSettings(clonePlainData(jsonData) as PersistedModelSettingsPayload);
  }

  dsAlert({ type: "success", message: t("user.importSuccess") });
}

function handleBeforeUnload(event) {
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
.settings-page-shell {
  height: 100%;
  background: transparent;
}

.settings-page {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  height: 100%;
  min-height: 0;
  font-family: "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", sans-serif;
  overflow: hidden;
}

.settings-sidebar {
  padding: 20px 16px 18px;
  border-right: 1px solid rgba(17, 24, 39, 0.06);
  background: rgba(255, 255, 255, 0.52);
  backdrop-filter: blur(22px);
  overflow-y: auto;
}

.settings-group-list {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-nav-group {
  h3 {
    margin: 0 0 8px;
    padding: 0 4px;
    color: #9ca3af;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
}

.settings-tab-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.settings-tab-button {
  border: 1px solid rgba(17, 24, 39, 0.06);
  border-radius: 16px;
  padding: 12px 14px;
  text-align: left;
  background: rgba(255, 255, 255, 0.84);
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-shadow: 0 8px 24px rgba(31, 41, 55, 0.04);
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    transform 0.2s ease,
    box-shadow 0.2s ease;

  span {
    font-size: 14px;
    font-weight: 600;
    color: #202124;
  }

  small {
    font-size: 11px;
    line-height: 1.4;
    color: #5f6368;
  }

  &:hover {
    border-color: rgba(17, 24, 39, 0.1);
    background-color: rgba(255, 255, 255, 0.96);
    transform: translateY(-1px);
    box-shadow: 0 12px 28px rgba(31, 41, 55, 0.06);
  }

  &.active {
    border-color: rgba(35, 95, 143, 0.14);
    background: #eef6ff;
    box-shadow: 0 14px 28px rgba(31, 41, 55, 0.06);
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
}

.settings-main-subtitle {
  margin-top: 6px;
  max-width: 36rem;
  font-size: 13px;
  line-height: 1.65;
  color: #5f6368;
}

.settings-main-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
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
  box-shadow: 0 8px 20px rgba(31, 41, 55, 0.04);

  .settings-status-dot {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background-color: rgba(95, 99, 104, 0.65);
    flex-shrink: 0;
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

  .settings-main-actions {
    justify-content: flex-start;
  }
}
</style>
