<template>
  <nav class="nav-group" :class="{ 'is-collapsed': !expanded }">
    <AppTooltip :text="expanded ? '' : t('chat.newChatConversation')" placement="right">
      <button class="nav-item" :class="{ 'is-active': chatDraftActive }" type="button" @click="$emit('new-chat')">
        <SvgIcon :src="newIcon" class="nav-icon" /><span v-if="expanded" class="nav-label">{{ t("chat.newChatConversation") }}</span>
      </button>
    </AppTooltip>
    <AppTooltip :text="expanded ? '' : t('chat.newImageCreation')" placement="right">
      <button class="nav-item" :class="{ 'is-active': imageDraftActive }" type="button" @click="$emit('new-image')">
        <SvgIcon :src="imageIcon" class="nav-icon" /><span v-if="expanded" class="nav-label">{{ t("chat.newImageCreation") }}</span>
      </button>
    </AppTooltip>
    <AppTooltip :text="expanded ? '' : t('chat.newVideoCreation')" placement="right">
      <button class="nav-item" :class="{ 'is-active': videoDraftActive }" type="button" @click="$emit('new-video')">
        <SvgIcon :src="videoIcon" class="nav-icon" /><span v-if="expanded" class="nav-label">{{ t("chat.newVideoCreation") }}</span>
      </button>
    </AppTooltip>
    <AppTooltip :text="expanded ? '' : t('assets.title')" placement="right">
      <button class="nav-item" :class="{ 'is-active': assetsActive }" type="button" @click="$emit('open-assets')">
        <SvgIcon :src="assetsIcon" class="nav-icon" /><span v-if="expanded" class="nav-label">{{ t("assets.title") }}</span>
      </button>
    </AppTooltip>

    <AppDropdownMenu placement="bottom-start">
      <template #trigger="{ toggle }">
        <AppTooltip :text="expanded ? '' : t('chat.conversationActions')" placement="right">
          <button class="nav-item" :class="{ 'is-active': deleteMode }" type="button" @click="toggle">
            <SvgIcon :src="optionsIcon" class="nav-icon" /><span v-if="expanded" class="nav-label">{{ t("chat.conversationActions") }}</span>
          </button>
        </AppTooltip>
      </template>
      <template #default="{ close }">
        <button class="menu-option" type="button" @click="close(); $emit('import-archive')">
          <SvgIcon class="menu-option-icon" :src="saveIcon" /><span>{{ t("chat.importConversation") }}</span>
        </button>
        <button class="menu-option" :class="{ 'is-danger': !deleteMode }" type="button" @click="close(); $emit('toggle-delete')">
          <SvgIcon class="menu-option-icon" :src="deleteIcon" /><span>{{ deleteMode ? t("chat.cancelDeletion") : t("chat.deleteConversations") }}</span>
        </button>
      </template>
    </AppDropdownMenu>

    <div v-if="expanded && deleteMode" class="nav-delete-panel is-active">
      <div class="delete-mode-toolbar">
        <button type="button" @click="$emit('select-all')">{{ t("chat.all") }}</button>
        <button type="button" @click="$emit('clear-selected')">{{ t("chat.clear") }}</button>
        <button class="is-danger" type="button" :disabled="selectedCount === 0" @click="$emit('delete-selected')">
          {{ t("chat.deleteSelectedConversations", { count: selectedCount }) }}
        </button>
      </div>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import AppDropdownMenu from "@/components/AppDropdownMenu.vue";
import AppTooltip from "@/components/AppTooltip.vue";
import SvgIcon from "@/components/SvgIcon.vue";
import assetsIcon from "@/assets/svg/assets32.svg";
import deleteIcon from "@/assets/svg/delete16.svg";
import imageIcon from "@/assets/svg/navImage24.svg";
import newIcon from "@/assets/svg/new24.svg";
import optionsIcon from "@/assets/svg/options24.svg";
import saveIcon from "@/assets/svg/save18.svg";
import videoIcon from "@/assets/svg/video24.svg";

withDefaults(defineProps<{
  expanded?: boolean;
  chatDraftActive?: boolean;
  imageDraftActive?: boolean;
  videoDraftActive?: boolean;
  assetsActive?: boolean;
  deleteMode?: boolean;
  selectedCount?: number;
}>(), { expanded: true, selectedCount: 0 });

defineEmits<{
  "new-chat": [];
  "new-image": [];
  "new-video": [];
  "open-assets": [];
  "import-archive": [];
  "toggle-delete": [];
  "select-all": [];
  "clear-selected": [];
  "delete-selected": [];
}>();

const { t } = useI18n();
</script>

<style scoped lang="scss">
.nav-group { display: flex; flex-direction: column; gap: 4px; }
.nav-group.is-collapsed { align-items: center; }
.nav-group.is-collapsed .nav-item { width: 36px; min-width: 36px; padding: 0; justify-content: center; }
.nav-group :deep(.app-tooltip-host), .nav-group :deep(.app-tooltip-trigger) { width: 100%; }
.nav-item {
  width: 100%;
  min-height: 36px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 10px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: oklch(var(--bc) / 0.82);
  cursor: pointer;
  text-align: left;
  transition: background-color 0.16s ease, color 0.16s ease, transform 0.16s ease;
}
.nav-item:hover { background: oklch(var(--bc) / 0.05); }
.nav-item:active { transform: scale(0.98); }
.nav-item.is-active { background: oklch(var(--p) / 0.12); color: oklch(var(--bc)); }
.nav-icon { width: 20px; height: 20px; flex: 0 0 auto; }
.nav-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 600; }
.nav-delete-panel { padding-top: 4px; }
.delete-mode-toolbar { display: grid; grid-template-columns: 1fr 1fr 1.4fr; gap: 5px; padding: 6px; border-radius: 10px; background: oklch(var(--bc) / 0.04); }
.delete-mode-toolbar button { min-width: 0; min-height: 30px; border: 0; border-radius: 7px; background: transparent; color: oklch(var(--bc) / 0.7); font-size: 11px; cursor: pointer; }
.delete-mode-toolbar button:disabled { opacity: 0.45; }
.delete-mode-toolbar button.is-danger { background: oklch(var(--er) / 0.9); color: white; }
.menu-option { width: 100%; min-height: 36px; display: flex; align-items: center; gap: 9px; padding: 0 10px; border: 0; border-radius: 8px; background: transparent; color: oklch(var(--bc) / 0.82); font-size: 12px; cursor: pointer; text-align: left; }
.menu-option:hover { background: oklch(var(--bc) / 0.05); }
.menu-option.is-danger { color: oklch(var(--er)); }
.menu-option-icon { width: 15px; height: 15px; color: oklch(var(--bc) / 0.62); }
</style>
