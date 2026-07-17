<template>
  <aside class="sidebar-container" :class="{ 'is-expanded': isExpanded }" :aria-expanded="isExpanded">
    <div class="sidebar-wrapper">
      <!-- Header: Back button (settings) or logo + toggle -->
      <div class="sidebar-header">
        <AppTooltip v-if="isSettingsRoute && isExpanded" :text="t('common.back')" placement="right">
          <button class="back-btn" type="button" @click="onBackFromSettings">
            <SvgIcon :src="backIcon" class="back-icon" />
            <span class="back-label">{{ t("common.back") }}</span>
          </button>
        </AppTooltip>
        <button v-else-if="isExpanded" class="brand-logo" type="button" @click="router.push({ name: 'home' })">
          <SvgIcon class="logo-icon" :src="brandIcon" colored />
          <span class="logo-text">{{ APP_NAME }} · {{ APP_VERSION }}</span>
        </button>

        <AppTooltip :text="t('chat.sidebarToggle')" placement="right">
          <button class="collapse-btn" type="button" :aria-label="t('chat.sidebarToggle')" @click="emit('toggle')">
            <SvgIcon :src="isExpanded ? collapseIcon : expandIcon" />
          </button>
        </AppTooltip>
      </div>

      <!-- Settings Navigation (when on settings route) -->
      <nav v-if="isSettingsRoute && isExpanded" class="settings-nav-area">
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

      <!-- Main Navigation (normal routes) -->
      <template v-else>
        <nav class="nav-group">
          <AppTooltip :text="isExpanded ? '' : t('chat.newChatConversation')" placement="right">
            <button class="nav-item" :class="{ 'is-active': isChatDraftRoute }" type="button" @click="onNewChat">
              <SvgIcon :src="newIcon" class="nav-icon" />
              <span v-if="isExpanded" class="nav-label">{{ t("chat.newChatConversation") }}</span>
            </button>
          </AppTooltip>
          <AppTooltip :text="isExpanded ? '' : t('chat.newImageCreation')" placement="right">
            <button class="nav-item" :class="{ 'is-active': isImageDraftRoute }" type="button" @click="onNewImage">
              <SvgIcon :src="libraryIcon" class="nav-icon" />
              <span v-if="isExpanded" class="nav-label">{{ t("chat.newImageCreation") }}</span>
            </button>
          </AppTooltip>
          <AppTooltip :text="isExpanded ? '' : t('chat.newVideoCreation')" placement="right">
            <button class="nav-item" :class="{ 'is-active': isVideoDraftRoute }" type="button" @click="onNewVideo">
              <SvgIcon :src="videoIcon" class="nav-icon" />
              <span v-if="isExpanded" class="nav-label">{{ t("chat.newVideoCreation") }}</span>
            </button>
          </AppTooltip>
          <AppTooltip :text="isExpanded ? '' : 'Assets'" placement="right">
            <button class="nav-item" :class="{ 'is-active': isAssetsRoute }" type="button" @click="router.push({ name: 'assets' })">
              <SvgIcon :src="assetsIcon" class="nav-icon" />
              <span v-if="isExpanded" class="nav-label">Assets</span>
            </button>
          </AppTooltip>
          <AppDropdownMenu placement="bottom-start">
            <template #trigger="{ toggle }">
              <AppTooltip :text="isExpanded ? '' : t('chat.conversationActions')" placement="right">
                <button class="nav-item" :class="{ 'is-active': isDeleteMode }" type="button" @click="toggle">
                  <SvgIcon :src="optionsIcon" class="nav-icon" />
                  <span v-if="isExpanded" class="nav-label">{{ t("chat.conversationActions") }}</span>
                </button>
              </AppTooltip>
            </template>
            <template #default="{ close }">
              <button class="menu-option" type="button" @click="onImportAnyArchiveFromMenu(close)">
                <SvgIcon class="menu-option-icon" :src="saveIcon" />
                <span>{{ t("chat.importConversation") }}</span>
              </button>
              <button class="menu-option" :class="{ 'is-danger': !isDeleteMode }" type="button" @click="onToggleDeleteModeFromMenu(close)">
                <SvgIcon class="menu-option-icon" :src="deleteIcon" />
                <span>{{ isDeleteMode ? t("chat.cancelDeletion") : t("chat.deleteConversations") }}</span>
              </button>
            </template>
          </AppDropdownMenu>
          <div v-if="isExpanded && isDeleteMode" class="nav-delete-panel is-active">
            <div v-if="isDeleteMode" class="delete-mode-toolbar">
              <button type="button" @click="selectAllConversations">{{ t("chat.all") }}</button>
              <button type="button" @click="clearSelectedConversations">{{ t("chat.clear") }}</button>
              <button class="is-danger" type="button" :disabled="selectedConversationCount === 0" @click="onDeleteSelectedConversations">
                {{ t("chat.deleteSelectedConversations", { count: selectedConversationCount }) }}
              </button>
            </div>
          </div>
        </nav>

        <!-- Recent Chats -->
        <Transition name="sidebar-panel">
          <div v-if="isExpanded" class="sidebar-panels">
            <div class="sidebar-section recents-section">
              <button
                class="section-toggle"
                :class="{ 'is-collapsed': !isChatSectionOpen }"
                type="button"
                :aria-expanded="isChatSectionOpen"
                @click="isChatSectionOpen = !isChatSectionOpen"
              >
                <span class="section-title">{{ t("chat.chatConversations") }}</span>
                <span class="section-count">{{ chatList.length }}</span>
                <span class="section-caret"></span>
              </button>
              <Transition name="section-list">
                <div v-if="isChatSectionOpen" class="section-body">
                  <div v-if="chatList.length === 0" class="empty-tip">{{ t("chat.noChats") }}</div>
                  <div v-else class="recents-list">
                    <div v-for="item in chatList" :key="item.cid" class="chat-item-wrapper">
                      <!-- Inline rename input replaces only the active chat row, keeping the list layout stable. -->
                      <input
                        v-if="isShowOptionCid === item.cid && isEditChatName"
                        ref="editChatNameInputElRef"
                        v-model="editChatName"
                        type="text"
                        class="rename-input"
                        @blur="changeChatName"
                        @keydown.enter.prevent="changeChatName"
                      />

                      <!-- Chat rows keep actions hidden until hover/active state so long titles remain easy to scan. -->
                      <div
                        v-else
                        class="chat-item"
                        :class="{
                          'is-active': activeRouteChatId === item.cid,
                          'is-selected': isDeleteMode && selectedChatIds.includes(item.cid),
                          'has-runtime-status': hasChatRuntimeStatus(item.cid),
                        }"
                      >
                        <input
                          v-if="isDeleteMode"
                          v-model="selectedChatIds"
                          class="row-select-checkbox"
                          type="checkbox"
                          :value="item.cid"
                          :aria-label="`Select ${item.cname}`"
                          @click.stop
                        />
                        <button class="chat-main-btn" type="button" @click="onSelectChat(item)">
                          <span class="chat-title-text">{{ item.cname }}</span>
                        </button>
                        <span
                          v-if="hasChatRuntimeStatus(item.cid)"
                          class="session-status-dot"
                          :class="getChatRuntimeStatusClass(item.cid)"
                          :title="getChatRuntimeLabel(item.cid)"
                          aria-hidden="true"
                        ></span>

                        <!-- Per-chat actions live in a dropdown; each action confirms before touching persisted chat data. -->
                        <AppDropdownMenu placement="bottom-end">
                          <template #trigger="{ toggle }">
                            <button class="chat-menu-btn" :aria-label="t('chat.moreActions')" @click.stop="toggle">
                              <span class="dot"></span>
                              <span class="dot"></span>
                              <span class="dot"></span>
                            </button>
                          </template>
                          <template #default="{ close }">
                            <button class="menu-option" type="button" @click="onExportChatArchive(item, close)">
                              <SvgIcon class="menu-option-icon" :src="saveIcon" />
                              <span>{{ t("chat.exportConversation") }}</span>
                            </button>
                            <button class="menu-option" type="button" @click="onEditChatName(item, close)">
                              <SvgIcon class="menu-option-icon" :src="editIcon" />
                              <span>{{ t("chat.renameChat") }}</span>
                            </button>
                            <button class="menu-option is-danger" type="button" @click="onDeleteChat(item, close)">
                              <SvgIcon class="menu-option-icon" :src="deleteIcon" />
                              <span>{{ t("chat.deleteChat") }}</span>
                            </button>
                          </template>
                        </AppDropdownMenu>
                      </div>
                    </div>
                  </div>
                </div>
              </Transition>
            </div>

            <div class="sidebar-section image-recents-section">
              <button
                class="section-toggle"
                :class="{ 'is-collapsed': !isImageSectionOpen }"
                type="button"
                :aria-expanded="isImageSectionOpen"
                @click="isImageSectionOpen = !isImageSectionOpen"
              >
                <span class="section-title">{{ t("chat.imageConversations") }}</span>
                <span class="section-count">{{ imageConversationList.length }}</span>
                <span class="section-caret"></span>
              </button>
              <Transition name="section-list">
                <div v-if="isImageSectionOpen" class="section-body">
                  <div v-if="imageConversationList.length === 0" class="empty-tip">{{ t("chat.noImageConversations") }}</div>
                  <div v-else class="recents-list">
                    <div v-for="item in imageConversationList" :key="item.iid" class="chat-item-wrapper">
                      <div
                        class="chat-item"
                        :class="{
                          'is-active': activeRouteImageId === item.iid,
                          'is-selected': isDeleteMode && selectedImageConversationIds.includes(item.iid),
                          'has-runtime-status': hasImageRuntimeStatus(item.iid),
                        }"
                      >
                        <input
                          v-if="isDeleteMode"
                          v-model="selectedImageConversationIds"
                          class="row-select-checkbox"
                          type="checkbox"
                          :value="item.iid"
                          :aria-label="`Select ${item.iname}`"
                          @click.stop
                        />
                        <button class="chat-main-btn" type="button" @click="onSelectImageConversation(item)">
                          <span class="chat-title-text">{{ item.iname }}</span>
                        </button>
                        <span
                          v-if="hasImageRuntimeStatus(item.iid)"
                          class="session-status-dot"
                          :class="getImageRuntimeStatusClass(item.iid)"
                          :title="getImageRuntimeLabel(item.iid)"
                          aria-hidden="true"
                        ></span>

                        <AppDropdownMenu placement="bottom-end">
                          <template #trigger="{ toggle }">
                            <button class="chat-menu-btn" :aria-label="t('chat.moreImageActions')" @click.stop="toggle">
                              <span class="dot"></span>
                              <span class="dot"></span>
                              <span class="dot"></span>
                            </button>
                          </template>
                          <template #default="{ close }">
                            <button class="menu-option" type="button" @click="onExportImageArchive(item, close)">
                              <SvgIcon class="menu-option-icon" :src="saveIcon" />
                              <span>{{ t("chat.exportImageConversation") }}</span>
                            </button>
                            <button class="menu-option is-danger" type="button" @click="onDeleteImageConversation(item, close)">
                              <SvgIcon class="menu-option-icon" :src="deleteIcon" />
                              <span>{{ t("chat.deleteImageConversation") }}</span>
                            </button>
                          </template>
                        </AppDropdownMenu>
                      </div>
                    </div>
                  </div>
                </div>
              </Transition>
            </div>

            <div class="sidebar-section video-recents-section">
              <button
                class="section-toggle"
                :class="{ 'is-collapsed': !isVideoSectionOpen }"
                type="button"
                :aria-expanded="isVideoSectionOpen"
                @click="isVideoSectionOpen = !isVideoSectionOpen"
              >
                <span class="section-title">{{ t("chat.videoConversations") }}</span>
                <span class="section-count">{{ videoConversationList.length }}</span>
                <span class="section-caret"></span>
              </button>
              <Transition name="section-list">
                <div v-if="isVideoSectionOpen" class="section-body">
                  <div v-if="videoConversationList.length === 0" class="empty-tip">{{ t("chat.noVideoConversations") }}</div>
                  <div v-else class="recents-list">
                    <div v-for="item in videoConversationList" :key="item.vid" class="chat-item-wrapper">
                      <div
                        class="chat-item"
                        :class="{
                          'is-active': activeRouteVideoId === item.vid,
                          'is-selected': isDeleteMode && selectedVideoConversationIds.includes(item.vid),
                          'has-runtime-status': hasVideoRuntimeStatus(item.vid),
                        }"
                      >
                        <input
                          v-if="isDeleteMode"
                          v-model="selectedVideoConversationIds"
                          class="row-select-checkbox"
                          type="checkbox"
                          :value="item.vid"
                          :aria-label="`Select ${item.vname}`"
                          @click.stop
                        />
                        <button class="chat-main-btn" type="button" @click="onSelectVideoConversation(item)">
                          <span class="chat-title-text">{{ item.vname }}</span>
                        </button>
                        <span
                          v-if="hasVideoRuntimeStatus(item.vid)"
                          class="session-status-dot"
                          :class="getVideoRuntimeStatusClass(item.vid)"
                          :title="getVideoRuntimeLabel(item.vid)"
                          aria-hidden="true"
                        ></span>

                        <AppDropdownMenu placement="bottom-end">
                          <template #trigger="{ toggle }">
                            <button class="chat-menu-btn" :aria-label="t('chat.moreActions')" @click.stop="toggle">
                              <span class="dot"></span>
                              <span class="dot"></span>
                              <span class="dot"></span>
                            </button>
                          </template>
                          <template #default="{ close }">
                            <button class="menu-option" type="button" @click="onExportVideoArchive(item, close)">
                              <SvgIcon class="menu-option-icon" :src="saveIcon" />
                              <span>{{ t("chat.exportVideoConversation") }}</span>
                            </button>
                            <button class="menu-option is-danger" type="button" @click="onDeleteVideoConversation(item, close)">
                              <SvgIcon class="menu-option-icon" :src="deleteIcon" />
                              <span>{{ t("chat.deleteVideoConversation") }}</span>
                            </button>
                          </template>
                        </AppDropdownMenu>
                      </div>
                    </div>
                  </div>
                </div>
              </Transition>
            </div>
          </div>
        </Transition>
      </template>

      <div class="sidebar-footer">
        <div class="settings-shell">
          <AppTooltip :text="isExpanded ? '' : t('home.settingsTitle')" placement="right">
            <button class="settings-btn" :class="{ 'is-active': isSettingsRoute }" type="button" @click="onShowModelSettings">
              <SvgIcon :src="settingIcon" style="width: 24px; height: 24px" />
              <span v-if="isExpanded">{{ t("home.settingsTitle") }}</span>
            </button>
          </AppTooltip>
        </div>

        <div class="quick-controls">
          <AppDropdownMenu :items="themeOptions" placement="top-start" :width="150" @select="handleThemeChange">
            <template #trigger="{ toggle }">
              <AppTooltip :text="t('theme.tooltip')" placement="right">
                <button class="quick-control-btn" type="button" :aria-label="t('theme.tooltip')" @click="toggle">
                  <span class="theme-swatch" :class="`is-${currentTheme}`"></span>
                </button>
              </AppTooltip>
            </template>
          </AppDropdownMenu>

          <AppDropdownMenu :items="localeOptions" placement="top-start" :width="150" @select="handleLocaleChange">
            <template #trigger="{ toggle }">
              <AppTooltip :text="t('language.tooltip')" placement="right">
                <button class="quick-control-btn" type="button" :aria-label="t('language.tooltip')" @click="toggle">
                  <span class="language-mark">{{ activeLanguageMark }}</span>
                </button>
              </AppTooltip>
            </template>
          </AppDropdownMenu>
        </div>
      </div>

      <!--
        ⚠️ Keep this dialog teleported to body.
        Native dialog returns to normal DOM flow for a frame on close; if it stays inside
        the sidebar, the modal can visibly jump left before disappearing.
      -->
      <Teleport to="body">
        <dialog
          ref="chatActionConfirmDialogRef"
          class="modal sidebar-action-confirm"
          @cancel.prevent="resolveChatActionConfirmation(false)"
          @close="resolveChatActionConfirmation(false)"
        >
          <div class="modal-box">
            <h3 class="sidebar-confirm-title">{{ chatActionConfirm.title }}</h3>
            <p class="sidebar-confirm-message">{{ chatActionConfirm.message }}</p>
            <div class="modal-action sidebar-confirm-actions">
              <button class="btn btn-ghost" type="button" @click="resolveChatActionConfirmation(false)">
                {{ t("chat.confirmActionCancel") }}
              </button>
              <button class="btn" :class="chatActionConfirm.danger ? 'btn-error' : 'btn-primary'" type="button" @click="resolveChatActionConfirmation(true)">
                {{ chatActionConfirm.confirmText }}
              </button>
            </div>
          </div>
        </dialog>
      </Teleport>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { useAppStore } from "@/store";
import { getChatList, deleteChat, renameChat, resetCurrentChatDraft, exportChatConversationArchive, importChatConversationArchive } from "@/services";
import {
  deleteImageConversation,
  getImageConversationList,
  exportImageConversationArchive,
  importImageConversationArchive,
  exportVideoConversationArchive,
  importVideoConversationArchive,
} from "@/services/creation";
import { deleteVideoConversation, getVideoConversationList } from "@/services/creation";
import { nextTick, ref, computed, onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { setAppLocale } from "@/i18n";
import { dsAlert } from "@/utils";
import { applyTheme, getStoredTheme } from "@/utils/theme";
import brandIcon from "@/assets/svg/app18.svg";
import newIcon from "@/assets/svg/new24.svg";
import settingIcon from "@/assets/svg/setting24.svg";
import libraryIcon from "@/assets/svg/navImage24.svg";
import assetsIcon from "@/assets/svg/assets32.svg";
import videoIcon from "@/assets/svg/video24.svg";
import collapseIcon from "@/assets/svg/collapse24.svg";
import expandIcon from "@/assets/svg/expand24.svg";
import editIcon from "@/assets/svg/edit24.svg";
import deleteIcon from "@/assets/svg/delete16.svg";
import saveIcon from "@/assets/svg/save18.svg";
import optionsIcon from "@/assets/svg/options24.svg";
import backIcon from "@/assets/svg/revert32.svg";
import AppDropdownMenu from "@/components/AppDropdownMenu.vue";
import SvgIcon from "@/components/SvgIcon.vue";
import AppTooltip from "@/components/AppTooltip.vue";
import { APP_NAME, APP_VERSION } from "@/constants";
type SettingTabKey_L = "chat-templates" | "chat-models" | "image-models" | "video-models" | "app";

const settingGroups = computed(() => [
  {
    key: "chat",
    label: t("user.groups.chat"),
    items: [
      { key: "chat-templates" as SettingTabKey_L, label: t("user.tabs.templates.label"), description: t("user.tabs.templates.description") },
      { key: "chat-models" as SettingTabKey_L, label: t("user.tabs.chatModels.label"), description: t("user.tabs.chatModels.description") },
    ],
  },
  {
    key: "image",
    label: t("user.groups.image"),
    items: [{ key: "image-models" as SettingTabKey_L, label: t("user.tabs.imageModels.label"), description: t("user.tabs.imageModels.description") }],
  },
  {
    key: "video",
    label: t("user.groups.video"),
    items: [{ key: "video-models" as SettingTabKey_L, label: t("user.tabs.videoModels.label"), description: t("user.tabs.videoModels.description") }],
  },
  {
    key: "app",
    label: t("user.groups.app"),
    items: [{ key: "app" as SettingTabKey_L, label: t("user.tabs.app.label"), description: t("user.tabs.app.description") }],
  },
]);

const props = defineProps({
  expanded: { type: Boolean, default: true },
});

const emit = defineEmits(["toggle"]);
const store = useAppStore();
const router = useRouter();
const route = useRoute();
const { t, locale } = useI18n();

const isExpanded = computed(() => props.expanded);
const chatList = computed(() => [...store.state.chatList].reverse());
const imageConversationList = computed(() => [...(store.state.imageConversationList || [])].reverse());
const videoConversationList = computed(() => [...(store.state.videoConversationList || [])].reverse());
const activeRouteChatId = computed(() => (route.name === "chat" && typeof route.params.cid === "string" ? route.params.cid : ""));
const activeRouteImageId = computed(() => (route.name === "image" && typeof route.params.iid === "string" ? route.params.iid : ""));
const activeRouteVideoId = computed(() => (route.name === "video" && typeof route.params.vid === "string" ? route.params.vid : ""));
const isChatDraftRoute = computed(() => route.name === "chat" && !activeRouteChatId.value);
const isImageDraftRoute = computed(() => route.name === "image" && !activeRouteImageId.value);
const isVideoDraftRoute = computed(() => route.name === "video" && !activeRouteVideoId.value);
const isAssetsRoute = computed(() => route.name === "assets");
const isSettingsRoute = computed(() => typeof route.name === "string" && route.name.startsWith("settings"));

const activeSettingsTab = computed<SettingTabKey_L>(() => {
  const name = route.name?.toString() || "";
  if (name === "settings-chat-templates") return "chat-templates";
  if (name === "settings-chat-models") return "chat-models";
  if (name === "settings-image-models") return "image-models";
  if (name === "settings-video-models") return "video-models";
  if (name === "settings-app") return "app";
  return "chat-models";
});
const isShowOptionCid = ref("");
const isEditChatName = ref(false);
const isChatSectionOpen = ref(true);
const isImageSectionOpen = ref(true);
const isVideoSectionOpen = ref(true);
const isDeleteMode = ref(false);
const currentTheme = ref(getStoredTheme());
const editChatName = ref("");
const originalChatName = ref("");
const editChatNameInputElRef = ref<HTMLInputElement[] | null>(null);
const selectedChatIds = ref<string[]>([]);
const selectedImageConversationIds = ref<string[]>([]);
const selectedVideoConversationIds = ref<string[]>([]);
const chatActionConfirmDialogRef = ref<HTMLDialogElement | null>(null);
const chatActionConfirm = ref({
  title: "",
  message: "",
  confirmText: "",
  danger: false,
});
const isRenameSubmitting = ref(false);
let chatActionConfirmResolve: ((confirmed: boolean) => void) | null = null;

type SidebarOption = {
  key: string;
  value: string;
  label: string;
  active: boolean;
};

const themeOptions = computed<SidebarOption[]>(() => [
  { key: "light", value: "light", label: t("theme.options.light"), active: currentTheme.value === "light" },
  { key: "dark", value: "dark", label: t("theme.options.dark"), active: currentTheme.value === "dark" },
  { key: "cupcake", value: "cupcake", label: t("theme.options.cupcake"), active: currentTheme.value === "cupcake" },
  { key: "acid", value: "acid", label: t("theme.options.acid"), active: currentTheme.value === "acid" },
  { key: "lemonade", value: "lemonade", label: t("theme.options.lemonade"), active: currentTheme.value === "lemonade" },
]);

const localeOptions = computed<SidebarOption[]>(() => [
  { key: "zh-CN", value: "zh-CN", label: t("language.options.zh-CN"), active: locale.value === "zh-CN" },
  { key: "en-US", value: "en-US", label: t("language.options.en-US"), active: locale.value === "en-US" },
]);

const activeLanguageMark = computed(() => (locale.value === "zh-CN" ? "ZH" : "EN"));
const selectedConversationCount = computed(
  () => selectedChatIds.value.length + selectedImageConversationIds.value.length + selectedVideoConversationIds.value.length,
);
const runningStatuses = new Set(["loading", "streaming"]);
const completedStatuses = new Set(["success", "error", "stopped"]);

const getChatRuntime = (cid: string) => store.state.chatRuntimeById?.[cid] || null;
const getImageRuntime = (iid: string) => store.state.imageRuntimeById?.[iid] || null;
const getVideoRuntime = (vid: string) => store.state.videoRuntimeById?.[vid] || null;
const getLastRun = (messages: any[] = []) => [...messages].reverse().find((message) => message?.role === "assistant" && message?.run)?.run || null;
const getImageRun = (iid: string) => getLastRun(store.state.imageMessagesById?.[iid] || []);
const getVideoRun = (vid: string) => getLastRun(store.state.videoMessagesById?.[vid] || []);

const isRuntimeRunning = (runtime: any) => Boolean(runtime?.pending || runningStatuses.has(runtime?.status || ""));
const isRuntimeCompletedNotice = (runtime: any) => Boolean(runtime?.completedNotice && completedStatuses.has(runtime?.status || ""));

const hasChatRuntimeStatus = (cid: string) => {
  const runtime = getChatRuntime(cid);
  return isRuntimeRunning(runtime) || isRuntimeCompletedNotice(runtime);
};

const hasImageRuntimeStatus = (iid: string) => {
  const runtime = getImageRuntime(iid);
  return isRuntimeRunning(runtime) || Boolean(runtime?.completedNotice && getImageRun(iid));
};

const hasVideoRuntimeStatus = (vid: string) => {
  const runtime = getVideoRuntime(vid);
  return isRuntimeRunning(runtime) || Boolean(runtime?.completedNotice && getVideoRun(vid));
};

const getRuntimeStatusClass = (runtime: any) => ({
  "is-running": isRuntimeRunning(runtime),
  "is-complete": isRuntimeCompletedNotice(runtime) && runtime?.status === "success",
  "is-error": isRuntimeCompletedNotice(runtime) && runtime?.status === "error",
  "is-stopped": isRuntimeCompletedNotice(runtime) && runtime?.status === "stopped",
});

const getChatRuntimeStatusClass = (cid: string) => getRuntimeStatusClass(getChatRuntime(cid));
const getCreationRuntimeStatusClass = (runtime: any, run: any) => ({
  "is-running": Boolean(runtime?.pending),
  "is-complete": Boolean(runtime?.completedNotice && run?.status === "success"),
  "is-error": Boolean(runtime?.completedNotice && run?.status === "error"),
  "is-stopped": Boolean(runtime?.completedNotice && run?.status === "stopped"),
});
const getImageRuntimeStatusClass = (iid: string) => getCreationRuntimeStatusClass(getImageRuntime(iid), getImageRun(iid));
const getVideoRuntimeStatusClass = (vid: string) => getCreationRuntimeStatusClass(getVideoRuntime(vid), getVideoRun(vid));

const getRuntimeLabel = (runtime: any) => {
  if (isRuntimeRunning(runtime)) return t("chat.runtimeRunning");
  if (runtime?.status === "error") return t("chat.runtimeError");
  if (runtime?.status === "stopped") return t("chat.runtimeStopped");
  return t("chat.runtimeCompleted");
};

const getChatRuntimeLabel = (cid: string) => getRuntimeLabel(getChatRuntime(cid));
const getCreationRuntimeLabel = (runtime: any, run: any) => {
  if (runtime?.pending) return t("chat.runtimeRunning");
  if (run?.status === "error") return t("chat.runtimeError");
  if (run?.status === "stopped") return t("chat.runtimeStopped");
  return t("chat.runtimeCompleted");
};
const getImageRuntimeLabel = (iid: string) => getCreationRuntimeLabel(getImageRuntime(iid), getImageRun(iid));
const getVideoRuntimeLabel = (vid: string) => getCreationRuntimeLabel(getVideoRuntime(vid), getVideoRun(vid));

watch(chatList, (items) => {
  const ids = new Set(items.map((item) => item.cid));
  selectedChatIds.value = selectedChatIds.value.filter((id) => ids.has(id));
});

watch(imageConversationList, (items) => {
  const ids = new Set(items.map((item) => item.iid));
  selectedImageConversationIds.value = selectedImageConversationIds.value.filter((id) => ids.has(id));
});

watch(videoConversationList, (items) => {
  const ids = new Set(items.map((item) => item.vid));
  selectedVideoConversationIds.value = selectedVideoConversationIds.value.filter((id) => ids.has(id));
});

const handleThemeChange = (item: SidebarOption) => {
  currentTheme.value = item.value;
  applyTheme(item.value);
};

const handleLocaleChange = (item: SidebarOption) => {
  setAppLocale(item.value as "zh-CN" | "en-US");
};

// New-chat behavior has one special case: when already on the draft chat route,
// reset the local draft instead of pushing the same route again.
const onNewChat = async () => {
  if (route.name === "chat" && !activeRouteChatId.value) {
    await resetCurrentChatDraft();
    return;
  }
  await router.push({ name: "chat" });
};

const onShowModelSettings = () => router.push({ name: "settings-chat-models" });

const onBackFromSettings = () => router.push({ name: "chat" });

const onNewImage = async () => {
  await router.push({ name: "image" });
};

const onNewVideo = async () => {
  await router.push({ name: "video" });
};

const onSelectImageConversation = async (item: any) => {
  if (item.iid === activeRouteImageId.value) return;
  await router.push({ name: "image", params: { iid: item.iid } });
};

const onSelectVideoConversation = async (item: any) => {
  if (item.vid === activeRouteVideoId.value) return;
  await router.push({ name: "video", params: { vid: item.vid } });
};

const onSelectChat = async (item: any) => {
  if (item.cid === activeRouteChatId.value) return;
  await router.push({ name: "chat", params: { cid: item.cid } });
};

const clearSelectedConversations = () => {
  selectedChatIds.value = [];
  selectedImageConversationIds.value = [];
  selectedVideoConversationIds.value = [];
};

const selectAllConversations = () => {
  selectedChatIds.value = chatList.value.map((item) => item.cid);
  selectedImageConversationIds.value = imageConversationList.value.map((item) => item.iid);
  selectedVideoConversationIds.value = videoConversationList.value.map((item) => item.vid);
};

const toggleDeleteMode = () => {
  isDeleteMode.value = !isDeleteMode.value;
  if (!isDeleteMode.value) clearSelectedConversations();
};

const onToggleDeleteModeFromMenu = (closeMenu: () => void) => {
  closeMenu?.();
  toggleDeleteMode();
};

// Convert the shared native dialog into an awaitable confirmation step.
// This keeps rename/delete flows linear and prevents service calls from running
// until the user makes an explicit choice.
const requestChatActionConfirmation = (payload: { title: string; message: string; confirmText: string; danger?: boolean }) =>
  new Promise<boolean>((resolve) => {
    const dialog = chatActionConfirmDialogRef.value;
    if (!dialog?.showModal) {
      resolve(false);
      return;
    }

    chatActionConfirm.value = {
      title: payload.title,
      message: payload.message,
      confirmText: payload.confirmText,
      danger: Boolean(payload.danger),
    };
    chatActionConfirmResolve = resolve;
    dialog.showModal();
  });

const resolveChatActionConfirmation = (confirmed: boolean) => {
  if (chatActionConfirmResolve) {
    chatActionConfirmResolve(Boolean(confirmed));
    chatActionConfirmResolve = null;
  }

  const dialog = chatActionConfirmDialogRef.value;
  if (dialog?.open) dialog.close();
};

const requestArchiveFile = (accept: string): Promise<File | null> =>
  new Promise((resolve) => {
    const input = document.createElement("input");
    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      if (input.parentNode) input.parentNode.removeChild(input);
      resolve(file);
    };
    input.type = "file";
    input.accept = accept;
    input.style.display = "none";
    input.onchange = () => finish(input.files?.[0] || null);
    document.body.appendChild(input);
    input.click();
    window.setTimeout(() => {
      window.addEventListener("focus", () => window.setTimeout(() => finish(input.files?.[0] || null), 250), { once: true });
    }, 0);
  });

const showArchiveError = (error: unknown) => {
  dsAlert({ type: "error", message: error instanceof Error ? error.message : String(error) });
};

const readArchiveType = (file: File): Promise<"chat" | "image" | "video"> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const archive = JSON.parse(String(reader.result || "{}")) as { format?: string; type?: string };
        if (archive.format !== "ai-api-hub.conversation" || !["chat", "image", "video"].includes(archive.type || "")) {
          reject(new Error("Invalid conversation archive."));
          return;
        }
        resolve(archive.type as "chat" | "image" | "video");
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error || new Error("Failed to read file."));
    reader.readAsText(file);
  });

const onExportChatArchive = async (item: any, closeMenu: () => void) => {
  closeMenu?.();
  try {
    await exportChatConversationArchive(item?.cid || "");
    dsAlert({ type: "success", message: t("chat.exportConversationSuccess") });
  } catch (error) {
    showArchiveError(error);
  }
};

const onImportAnyArchive = async () => {
  const file = await requestArchiveFile(".aihub-chat.json,.aihub-image.json,.aihub-video.json,application/json");
  if (!file) return;
  try {
    const type = await readArchiveType(file);
    if (type === "chat") {
      const cid = await importChatConversationArchive(file);
      await getChatList();
      await router.push({ name: "chat", params: { cid } });
    } else if (type === "image") {
      const iid = await importImageConversationArchive(file);
      await getImageConversationList();
      await router.push({ name: "image", params: { iid } });
    } else {
      const vid = await importVideoConversationArchive(file);
      await getVideoConversationList();
      await router.push({ name: "video", params: { vid } });
    }
    dsAlert({ type: "success", message: t("chat.importConversationSuccess") });
  } catch (error) {
    showArchiveError(error);
  }
};

const onImportAnyArchiveFromMenu = async (closeMenu: () => void) => {
  closeMenu?.();
  await onImportAnyArchive();
};

const onExportImageArchive = async (item: any, closeMenu: () => void) => {
  closeMenu?.();
  try {
    await exportImageConversationArchive(item?.iid || "");
    dsAlert({ type: "success", message: t("chat.exportConversationSuccess") });
  } catch (error) {
    showArchiveError(error);
  }
};

const onExportVideoArchive = async (item: any, closeMenu: () => void) => {
  closeMenu?.();
  try {
    await exportVideoConversationArchive(item?.vid || "");
    dsAlert({ type: "success", message: t("chat.exportConversationSuccess") });
  } catch (error) {
    showArchiveError(error);
  }
};

// Delete is destructive, so it always asks first. If the deleted chat is open,
// route back to the draft chat view to avoid rendering a missing conversation.
const onDeleteChat = async (item: any, closeMenu: () => void) => {
  closeMenu?.();
  const chatId = item?.cid || "";
  const confirmed = await requestChatActionConfirmation({
    title: t("chat.confirmDeleteChatTitle"),
    message: t("chat.confirmDeleteChat", { name: item?.cname || "" }),
    confirmText: t("chat.confirmDeleteChatConfirm"),
    danger: true,
  });
  if (!confirmed) return;

  if (chatId) await deleteChat(chatId);
  if (chatId && chatId === activeRouteChatId.value) {
    await router.replace({ name: "chat" });
  }
  isShowOptionCid.value = "";
  selectedChatIds.value = selectedChatIds.value.filter((id) => id !== chatId);
};

const onDeleteSelectedConversations = async () => {
  const chatIds = [...selectedChatIds.value];
  const imageIds = [...selectedImageConversationIds.value];
  const videoIds = [...selectedVideoConversationIds.value];
  const total = chatIds.length + imageIds.length + videoIds.length;
  if (!total) return;

  const confirmed = await requestChatActionConfirmation({
    title: t("chat.confirmDeleteSelectedConversationsTitle"),
    message: t("chat.confirmDeleteSelectedConversations", { count: total }),
    confirmText: t("chat.confirmDeleteChatConfirm"),
    danger: true,
  });
  if (!confirmed) return;

  for (const id of chatIds) {
    await deleteChat(id);
  }
  for (const id of imageIds) {
    await deleteImageConversation(id);
  }
  for (const id of videoIds) {
    await deleteVideoConversation(id);
  }
  if (chatIds.includes(activeRouteChatId.value)) {
    await router.replace({ name: "chat" });
  } else if (imageIds.includes(activeRouteImageId.value)) {
    await router.replace({ name: "image" });
  } else if (videoIds.includes(activeRouteVideoId.value)) {
    await router.replace({ name: "video" });
  }
  clearSelectedConversations();
  isDeleteMode.value = false;
  isShowOptionCid.value = "";
};

const onDeleteImageConversation = async (item: any, closeMenu: () => void) => {
  closeMenu?.();
  const imageId = item?.iid || "";
  const confirmed = await requestChatActionConfirmation({
    title: t("chat.confirmDeleteImageConversationTitle"),
    message: t("chat.confirmDeleteImageConversation", { name: item?.iname || "" }),
    confirmText: t("chat.confirmDeleteChatConfirm"),
    danger: true,
  });
  if (!confirmed) return;

  if (imageId) await deleteImageConversation(imageId);
  if (imageId && imageId === activeRouteImageId.value) {
    await router.replace({ name: "image" });
  }
  selectedImageConversationIds.value = selectedImageConversationIds.value.filter((id) => id !== imageId);
};

const onDeleteVideoConversation = async (item: any, closeMenu: () => void) => {
  closeMenu?.();
  const videoId = item?.vid || "";
  const confirmed = await requestChatActionConfirmation({
    title: t("chat.confirmDeleteVideoConversationTitle"),
    message: t("chat.confirmDeleteVideoConversation", { name: item?.vname || "" }),
    confirmText: t("chat.confirmDeleteChatConfirm"),
    danger: true,
  });
  if (!confirmed) return;

  if (videoId) await deleteVideoConversation(videoId);
  if (videoId && videoId === activeRouteVideoId.value) {
    await router.replace({ name: "video" });
  }
  selectedVideoConversationIds.value = selectedVideoConversationIds.value.filter((id) => id !== videoId);
};

// Start inline rename with the existing name selected. Keep a copy of the original
// value so the confirmation can show the exact before/after rename.
const onEditChatName = async (item: any, closeMenu: () => void) => {
  closeMenu?.();
  const chatId = item?.cid || "";
  isShowOptionCid.value = chatId;
  isEditChatName.value = true;
  originalChatName.value = item?.cname || "";
  editChatName.value = originalChatName.value;
  await nextTick();
  if (editChatNameInputElRef.value?.[0]) {
    editChatNameInputElRef.value[0].focus();
    editChatNameInputElRef.value[0].select();
  }
};

// Important: Enter submits and then the input can blur, so this path may be invoked
// twice. The submit lock prevents duplicate confirmation dialogs and duplicate API calls.
const changeChatName = async () => {
  if (isRenameSubmitting.value) return;
  const nextName = editChatName.value.trim();
  const chatId = isShowOptionCid.value;

  if (!chatId || !nextName || nextName === originalChatName.value) {
    isEditChatName.value = false;
    editChatName.value = "";
    originalChatName.value = "";
    isShowOptionCid.value = "";
    return;
  }

  isRenameSubmitting.value = true;
  const confirmed = await requestChatActionConfirmation({
    title: t("chat.confirmRenameChatTitle"),
    message: t("chat.confirmRenameChat", { oldName: originalChatName.value, newName: nextName }),
    confirmText: t("chat.confirmRenameChatConfirm"),
  });
  if (confirmed) await renameChat(chatId, nextName);
  isRenameSubmitting.value = false;
  isEditChatName.value = false;
  editChatName.value = "";
  originalChatName.value = "";
  isShowOptionCid.value = "";
};

onMounted(async () => {
  await getChatList();
  await getImageConversationList();
  await getVideoConversationList();
});
</script>

<style lang="scss" scoped>
$sidebar-w-collapsed: 68px;
$sidebar-w-expanded: 280px;
$radius-md: 12px;

.sidebar-container {
  height: 100%;
  position: relative;
  z-index: 100;
  width: $sidebar-w-collapsed;
  flex: 0 0 $sidebar-w-collapsed;
  background: oklch(var(--b1) / 0.96);
  border-right: 1px solid oklch(var(--p) / 0.08);
  overflow: hidden;
  contain: layout paint style;
  transform: translateX(0);

  &.is-expanded {
    width: $sidebar-w-expanded;
    flex-basis: $sidebar-w-expanded;
  }

  &:not(.is-expanded) {
    .sidebar-wrapper {
      padding-inline: 12px;
    }

    .sidebar-header {
      justify-content: center;
    }

    .nav-group {
      align-items: center;
    }

    .nav-item,
    .settings-btn {
      width: 36px;
      min-width: 36px;
      padding: 0;
      flex: 0 0 36px;
      justify-content: center;
    }

    .quick-control-btn {
      width: 36px;
      height: 36px;
    }

    .quick-controls {
      align-items: center;
      flex-direction: column;
    }

    .settings-shell {
      flex: 0 0 auto;

      :deep(.app-tooltip-host),
      :deep(.app-tooltip-trigger) {
        width: 36px;
      }
    }

    .sidebar-footer {
      display: flex;
      align-items: center;
      flex-direction: column;
      justify-content: center;
    }
  }
}

.sidebar-wrapper {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  padding: 16px 12px;
  box-sizing: border-box;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  margin-bottom: 16px;
  gap: 8px;
}

.brand-logo {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  height: 36px;
  padding: 0 10px;
  border: 0;
  background: transparent;
  color: oklch(var(--bc));
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  border-radius: $radius-md;
  font: inherit;
  text-align: left;
  transition:
    background-color 0.16s ease,
    color 0.16s ease,
    transform 0.16s ease;

  &:hover {
    background: oklch(var(--bc) / 0.05);
    color: oklch(var(--bc));
  }

  &:active {
    transform: scale(0.98);
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px oklch(var(--p) / 0.12);
  }

  .logo-icon {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
  }

  .logo-text {
    margin-left: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.collapse-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: $radius-md;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: oklch(var(--bc) / 0.7);
  flex-shrink: 0;
  transition:
    background-color 0.16s ease,
    color 0.16s ease,
    transform 0.16s ease;

  &:hover {
    background: oklch(var(--bc) / 0.06);
    color: oklch(var(--bc));
  }

  &:active {
    transform: scale(0.96);
  }
}

.nav-group {
  display: flex;
  flex-direction: column;
  gap: 4px;

  :deep(.app-tooltip-host),
  :deep(.app-tooltip-trigger) {
    width: 100%;
  }
}

.nav-item {
  height: 36px;
  padding: 0 12px;
  border: none;
  border-radius: $radius-md;
  background: transparent;
  display: flex;
  align-items: center;
  color: oklch(var(--bc) / 0.82);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  width: 100%;
  box-sizing: border-box;
  transition:
    background-color 0.16s ease,
    color 0.16s ease,
    transform 0.16s ease;

  .nav-icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  .nav-label {
    margin-left: 12px;
    white-space: nowrap;
  }

  &:hover {
    background: oklch(var(--bc) / 0.05);
    color: oklch(var(--bc));
  }

  &:active {
    transform: scale(0.98);
  }

  &.is-active {
    background: oklch(var(--p) / 0.12);
    color: oklch(var(--p));
    font-weight: 600;
  }
}

.nav-delete-panel {
  margin-top: 2px;
}

.delete-mode-toolbar {
  display: grid;
  grid-template-columns: 1fr 1fr 1.4fr;
  gap: 6px;
  margin: 6px 0 4px;
  padding: 6px;
  border-radius: 12px;
  background: oklch(var(--bc) / 0.04);

  button {
    min-height: 30px;
    padding: 0 8px;
    border: none;
    border-radius: 8px;
    background: oklch(var(--b1));
    color: oklch(var(--bc) / 0.7);
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;

    &:hover:not(:disabled) {
      background: oklch(var(--b2));
      color: oklch(var(--bc));
    }

    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    &.is-danger {
      background: oklch(var(--er));
      color: oklch(var(--nc));

      &:hover:not(:disabled) {
        background: oklch(var(--er) / 0.9);
        color: oklch(var(--nc));
      }
    }
  }
}

.sidebar-container:not(.is-expanded) .nav-group :deep(.app-tooltip-host),
.sidebar-container:not(.is-expanded) .nav-group :deep(.app-tooltip-trigger) {
  width: 36px;
}

.sidebar-section {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 0 0 auto;
}

.sidebar-panels {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding-right: 2px;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: oklch(var(--bc) / 0.12);
    border-radius: 4px;
  }
}

.section-toggle {
  width: 100%;
  height: 32px;
  padding: 0 8px 0 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: oklch(var(--bc) / 0.45);
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  text-align: left;
  transition:
    background-color 0.16s ease,
    color 0.16s ease;

  &:hover {
    background: oklch(var(--bc) / 0.04);
    color: oklch(var(--bc) / 0.62);
  }

  .section-title {
    flex: 1;
    min-width: 0;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.section-count {
  min-width: 20px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: oklch(var(--b2));
  color: oklch(var(--bc) / 0.62);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
}

.section-caret {
  width: 7px;
  height: 7px;
  border-right: 1.5px solid currentColor;
  border-bottom: 1.5px solid currentColor;
  transform: rotate(45deg) translateY(-1px);
  transition: transform 0.16s ease;
  flex-shrink: 0;
}

.section-toggle.is-collapsed .section-caret {
  transform: rotate(-45deg);
}

.section-body {
  margin-top: 4px;
}

.sidebar-panel-enter-active,
.sidebar-panel-leave-active {
  transition:
    opacity 0.16s ease,
    transform 0.16s ease;
}

.sidebar-panel-enter-from,
.sidebar-panel-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}

.recents-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: visible;
}

.section-list-enter-active,
.section-list-leave-active {
  overflow: hidden;
  transition:
    opacity 0.14s ease,
    max-height 0.18s ease;
}

.section-list-enter-from,
.section-list-leave-to {
  max-height: 0;
  opacity: 0;
}

.section-list-enter-to,
.section-list-leave-from {
  max-height: 720px;
  opacity: 1;
}

.empty-tip {
  padding: 12px;
  color: oklch(var(--bc) / 0.45);
  font-size: 12px;
}

.chat-item-wrapper {
  width: 100%;
}

.chat-item {
  position: relative;
  display: flex;
  align-items: center;
  height: 36px;
  border-radius: $radius-md;
  padding: 0 4px;
  color: oklch(var(--bc) / 0.82);
  transition:
    background-color 0.16s ease,
    color 0.16s ease;

  &:hover,
  &.is-active,
  &.is-selected {
    background: oklch(var(--p) / 0.12);
    color: oklch(var(--bc));

    .chat-menu-btn {
      opacity: 1;
    }
  }

  &.is-active .chat-title-text {
    font-weight: 600;
    color: oklch(var(--p));
  }
}

.row-select-checkbox {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
  margin: 0 0 0 4px;
  accent-color: oklch(var(--p));
  cursor: pointer;
}

.chat-main-btn {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
}

.chat-title-text {
  flex: 1;
  font-size: 12px;
  text-align: left;
  color: oklch(var(--bc) / 0.82);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-left: 12px;
}

.chat-menu-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2.5px;
  cursor: pointer;
  opacity: 0;
  flex-shrink: 0;

  &:hover {
    background: rgba(0, 0, 0, 0.06);
  }

  .dot {
    width: 3.5px;
    height: 3.5px;
    border-radius: 50%;
    background: oklch(var(--bc) / 0.62);
  }
}

.session-status-dot {
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  margin-right: 4px;
  border-radius: 999px;
  background: oklch(var(--p));
  box-shadow: 0 0 0 2px oklch(var(--b1));

  &.is-running {
    background: oklch(var(--su));
    animation: sessionStatusPulse 1.2s ease-in-out infinite;
  }

  &.is-error {
    background: oklch(var(--er));
  }

  &.is-stopped {
    background: oklch(var(--bc) / 0.42);
  }
}

@keyframes sessionStatusPulse {
  0%,
  100% {
    transform: scale(0.9);
    opacity: 0.72;
  }

  50% {
    transform: scale(1.18);
    opacity: 1;
  }
}

.menu-option {
  width: 100%;
  min-width: 150px;
  height: 32px;
  padding: 0 10px;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: oklch(var(--bc) / 0.82);
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  text-align: left;
  cursor: pointer;
  transition:
    background-color 0.16s ease,
    color 0.16s ease;

  &:hover,
  &:focus-visible {
    background: #f3f4f6;
    color: oklch(var(--bc));
    outline: none;

    .menu-option-icon {
      color: oklch(var(--bc));
    }
  }

  &.is-danger {
    color: #dc2626;

    .menu-option-icon {
      color: #ef4444;
    }

    &:hover,
    &:focus-visible {
      background: oklch(var(--er) / 0.12);
      color: #b91c1c;

      .menu-option-icon {
        color: #dc2626;
      }
    }
  }
}

.menu-option-icon {
  width: 16px;
  height: 16px;
  color: oklch(var(--bc) / 0.62);
  flex-shrink: 0;
  transition: color 0.16s ease;
}

.sidebar-action-confirm {
  // DaisyUI animates dialog backdrops by default; disable it here to avoid a visible mask flash.
  &::backdrop {
    background: oklch(var(--bc) / 0.24);
    animation: none;
  }

  .modal-box {
    max-width: 420px;
    padding: 24px;
    border: 1px solid oklch(var(--bc) / 0.12);
    background: oklch(var(--b1));
    border-radius: 8px;
    box-shadow: 0 18px 48px oklch(var(--bc) / 0.16);
  }

  .sidebar-confirm-title {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: oklch(var(--bc));
  }

  .sidebar-confirm-message {
    margin: 12px 0 0;
    line-height: 1.55;
    color: oklch(var(--bc) / 0.72);
  }

  .sidebar-confirm-actions {
    gap: 8px;
  }
}

.rename-input {
  width: calc(100% - 8px);
  height: 32px;
  margin: 0 4px;
  padding: 0 10px;
  border: 1px solid #e4e4e7;
  border-radius: 8px;
  background: oklch(var(--b1));
  font-size: 12px;
  outline: none;
  box-sizing: border-box;

  &:focus {
    border-color: oklch(var(--p));
    box-shadow: 0 0 0 2px oklch(var(--p) / 0.1);
  }
}

.sidebar-footer {
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  display: flex;
  align-items: center;
  gap: 6px;
}

.settings-shell {
  flex: 1;
  min-width: 0;

  :deep(.app-tooltip-host),
  :deep(.app-tooltip-trigger) {
    width: 100%;
  }
}

.quick-controls {
  display: flex;
  flex: 0 0 auto;
  gap: 4px;

  :deep(.app-dropdown-trigger),
  :deep(.app-tooltip-host),
  :deep(.app-tooltip-trigger) {
    flex: 0 0 auto;
  }
}

.quick-control-btn {
  width: 32px;
  height: 36px;
  padding: 0;
  border: none;
  border-radius: $radius-md;
  background: transparent;
  color: oklch(var(--bc) / 0.82);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    background-color 0.16s ease,
    color 0.16s ease,
    transform 0.16s ease;

  &:hover {
    background: oklch(var(--bc) / 0.05);
    color: oklch(var(--bc));
  }

  &:active {
    transform: scale(0.98);
  }
}

.theme-swatch {
  width: 19px;
  height: 19px;
  border-radius: 999px;
  border: 1px solid rgba(17, 24, 39, 0.16);
  background: linear-gradient(135deg, #ffffff 0 50%, #111827 50% 100%);
  box-shadow: 0 1px 2px rgba(17, 24, 39, 0.12);
  flex-shrink: 0;

  &.is-light {
    background: linear-gradient(135deg, #ffffff 0 50%, #e5e7eb 50% 100%);
  }

  &.is-dark {
    background: linear-gradient(135deg, #111827 0 50%, #374151 50% 100%);
  }

  &.is-cupcake {
    background: linear-gradient(135deg, #f9a8d4 0 50%, #bfdbfe 50% 100%);
  }

  &.is-acid {
    background: linear-gradient(135deg, #a3e635 0 50%, #22d3ee 50% 100%);
  }

  &.is-lemonade {
    background: linear-gradient(135deg, #fde68a 0 50%, #84cc16 50% 100%);
  }
}

.language-mark {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  border: 1px solid rgba(17, 24, 39, 0.12);
  background: #f9fafb;
  color: #111827;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  flex-shrink: 0;
}

.settings-btn {
  width: 100%;
  min-width: 0;
  height: 36px;
  padding: 0 12px;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  justify-content: flex-start;
  cursor: pointer;
  border: 0;
  border-radius: $radius-md;
  background: transparent;
  color: #374151;
  font: inherit;
  transition:
    background-color 0.16s ease,
    color 0.16s ease,
    transform 0.16s ease;

  &:hover,
  &.is-active {
    background: oklch(var(--b3));
    color: oklch(var(--bc));
  }

  &.is-active {
    background: oklch(var(--p) / 0.12);
    color: #1d4ed8;
    font-weight: 600;
  }

  &:active {
    transform: scale(0.98);
  }

  svg {
    height: 24px;
    width: 24px;
    flex-shrink: 0;
  }

  span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

/* ---- Settings nav (inside sidebar) ---- */
.back-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  height: 36px;
  padding: 0 10px;
  border: none;
  background: transparent;
  color: oklch(var(--bc) / 0.72);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border-radius: $radius-md;
  transition:
    background-color 0.16s ease,
    color 0.16s ease;

  &:hover {
    background: oklch(var(--bc) / 0.06);
    color: oklch(var(--bc));
  }

  .back-icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  .back-label {
    margin-left: 8px;
    white-space: nowrap;
  }
}

.settings-nav-area {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding-right: 2px;
  display: flex;
  flex-direction: column;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: oklch(var(--bc) / 0.12);
    border-radius: 4px;
  }
}

.settings-title {
  margin: 0 4px 18px;
  color: oklch(var(--bc));
  font-size: 18px;
  font-weight: 700;
  line-height: 1.2;
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
    color: oklch(var(--bc) / 0.45);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
}

.settings-tab-btn {
  border: 1px solid oklch(var(--bc) / 0.06);
  border-radius: 16px;
  padding: 12px 14px;
  text-align: left;
  background: oklch(var(--b1) / 0.84);
  box-shadow: 0 8px 24px oklch(var(--bc) / 0.04);
  cursor: pointer;
  transition:
    border-color 0.16s ease,
    background-color 0.16s ease;

  span,
  small {
    display: block;
  }

  span {
    font-size: 13px;
    font-weight: 600;
    color: oklch(var(--bc));
  }

  small {
    margin-top: 4px;
    font-size: 10px;
    line-height: 1.4;
    color: oklch(var(--bc) / 0.68);
  }

  &:hover,
  &.active {
    border-color: oklch(var(--p) / 0.14);
    background: oklch(var(--p) / 0.12);
  }
}

/* Collapsed sidebar: back button compact */
.sidebar-container:not(.is-expanded) {
  .back-btn {
    width: 36px;
    min-width: 36px;
    padding: 0;
    flex: 0 0 36px;
    justify-content: center;
  }

  .settings-title,
  .settings-nav-area {
    display: none;
  }
}

@media (max-width: 768px) {
  .sidebar-container {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    background: oklch(var(--b1) / 0.98);
    width: min(86vw, $sidebar-w-expanded);
    flex-basis: auto;
    max-width: $sidebar-w-expanded;
    transform: translateX(-100%);
    opacity: 0;
    pointer-events: none;
    box-shadow: 18px 0 44px oklch(var(--bc) / 0.16);
    transition:
      transform 0.24s ease,
      opacity 0.24s ease,
      width 0.22s ease,
      background-color 0.22s ease,
      border-color 0.22s ease;

    &.is-expanded {
      transform: translateX(0);
      opacity: 1;
      pointer-events: auto;
    }

    &:not(.is-expanded) {
      border-right: none;
    }
  }
}
</style>
