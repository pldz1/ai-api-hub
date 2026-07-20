<template>
  <nav class="settings-nav-area">
    <h2 class="settings-title">{{ t("user.app.title") }}</h2>
    <section v-for="group in settingGroups" :key="group.key" class="settings-nav-group">
      <h3>{{ group.label }}</h3>
      <button
        v-for="item in group.items"
        :key="item.key"
        class="settings-tab-btn"
        :class="{ active: activeSettingsTab === item.key }"
        type="button"
        @click="router.push({ name: `settings-${item.key}` })"
      >
        <span>{{ item.label }}</span>
        <small>{{ item.description }}</small>
      </button>
    </section>
  </nav>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";

type SettingTabKey = "chat-templates" | "chat-models" | "image-models" | "video-models" | "app";

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const activeSettingsTab = computed<SettingTabKey>(() => {
  const name = route.name?.toString() || "";
  if (name === "settings-chat-templates") return "chat-templates";
  if (name === "settings-image-models") return "image-models";
  if (name === "settings-video-models") return "video-models";
  if (name === "settings-app") return "app";
  return "chat-models";
});

const settingGroups = computed(() => [
  {
    key: "chat",
    label: t("user.groups.chat"),
    items: [
      { key: "chat-templates" as const, label: t("user.tabs.templates.label"), description: t("user.tabs.templates.description") },
      { key: "chat-models" as const, label: t("user.tabs.chatModels.label"), description: t("user.tabs.chatModels.description") },
    ],
  },
  {
    key: "image",
    label: t("user.groups.image"),
    items: [{ key: "image-models" as const, label: t("user.tabs.imageModels.label"), description: t("user.tabs.imageModels.description") }],
  },
  {
    key: "video",
    label: t("user.groups.video"),
    items: [{ key: "video-models" as const, label: t("user.tabs.videoModels.label"), description: t("user.tabs.videoModels.description") }],
  },
  {
    key: "app",
    label: t("user.groups.app"),
    items: [{ key: "app" as const, label: t("user.tabs.app.label"), description: t("user.tabs.app.description") }],
  },
]);
</script>

<style scoped lang="scss">
.settings-nav-area {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
  padding: 4px 2px 12px;
  scrollbar-width: thin;
  scrollbar-color: oklch(var(--bc) / 0.12) transparent;
}

.settings-title { margin: 4px 8px 2px; font-size: 18px; line-height: 1.2; font-weight: 700; color: oklch(var(--bc)); }
.settings-nav-group { display: flex; flex-direction: column; gap: 7px; }
.settings-nav-group h3 { margin: 0 8px; color: oklch(var(--bc) / 0.45); font-size: 11px; font-weight: 750; letter-spacing: 0.06em; text-transform: uppercase; }
.settings-tab-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  padding: 11px 12px;
  border: 1px solid oklch(var(--bc) / 0.06);
  border-radius: 10px;
  background: oklch(var(--b1) / 0.84);
  color: oklch(var(--bc));
  text-align: left;
  cursor: pointer;
  box-shadow: 0 8px 24px oklch(var(--bc) / 0.04);
  transition: border-color 0.16s ease, background-color 0.16s ease;
}
.settings-tab-btn span { font-size: 13px; font-weight: 700; }
.settings-tab-btn small { font-size: 11px; line-height: 1.4; color: oklch(var(--bc) / 0.68); }
.settings-tab-btn.active { border-color: oklch(var(--p) / 0.14); background: oklch(var(--p) / 0.12); }
</style>
