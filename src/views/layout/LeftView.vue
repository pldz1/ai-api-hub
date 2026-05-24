<template>
  <aside class="sidebar-container" :class="{ 'is-expanded': isExpanded }" :aria-expanded="isExpanded">
    <div class="sidebar-wrapper">
      <!-- Header: Logo and Toggle Button -->
      <div class="sidebar-header">
        <a v-if="isExpanded" class="brand-logo" href="/login">
          <SvgIcon class="logo-icon" :src="brandIcon" colored />
          <span class="logo-text">AI API HUB - v0.0.1</span>
        </a>

        <AppTooltip :text="t('chat.sidebarToggle')" placement="right">
          <button class="collapse-btn" type="button" :aria-label="t('chat.sidebarToggle')" @click="emit('toggle')">
            <SvgIcon :src="isExpanded ? collapseIcon : expandIcon" />
          </button>
        </AppTooltip>
      </div>

      <!-- Main Navigation -->
      <nav class="nav-group">
        <AppTooltip :text="isExpanded ? '' : 'New chat conversation'" placement="right">
          <button class="nav-item" :class="{ 'is-active': isChatDraftRoute }" type="button" @click="onNewChat">
            <SvgIcon :src="newIcon" class="nav-icon" />
            <span v-if="isExpanded" class="nav-label">New chat conversation</span>
          </button>
        </AppTooltip>
        <AppTooltip :text="isExpanded ? '' : 'New image creation'" placement="right">
          <button class="nav-item" :class="{ 'is-active': isImageDraftRoute }" type="button" @click="onNewImage">
            <SvgIcon :src="libraryIcon" class="nav-icon" />
            <span v-if="isExpanded" class="nav-label">New image creation</span>
          </button>
        </AppTooltip>
        <div v-if="isExpanded" class="nav-delete-panel" :class="{ 'is-active': isDeleteMode }">
          <button class="nav-delete-btn" type="button" @click="toggleDeleteMode">
            <SvgIcon :src="deleteIcon" class="nav-icon" />
            <span>{{ isDeleteMode ? "Cancel deletion" : "Delete conversations" }}</span>
          </button>
          <div v-if="isDeleteMode" class="delete-mode-toolbar">
            <button type="button" @click="selectAllConversations">All</button>
            <button type="button" @click="clearSelectedConversations">Clear</button>
            <button class="is-danger" type="button" :disabled="selectedConversationCount === 0" @click="onDeleteSelectedConversations">
              Delete {{ selectedConversationCount || "" }}
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
              <span class="section-title">Chat Conversations</span>
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
              <span class="section-title">Image Conversations</span>
              <span class="section-count">{{ imageConversationList.length }}</span>
              <span class="section-caret"></span>
            </button>
            <Transition name="section-list">
              <div v-if="isImageSectionOpen" class="section-body">
                <div v-if="imageConversationList.length === 0" class="empty-tip">No image conversations yet</div>
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
                          <button class="chat-menu-btn" aria-label="More image actions" @click.stop="toggle">
                            <span class="dot"></span>
                            <span class="dot"></span>
                            <span class="dot"></span>
                          </button>
                        </template>
                        <template #default="{ close }">
                          <button class="menu-option is-danger" type="button" @click="onDeleteImageConversation(item, close)">
                            <SvgIcon class="menu-option-icon" :src="deleteIcon" />
                            <span>Delete image conversation</span>
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

      <div class="sidebar-footer">
        <div class="settings-shell">
          <AppTooltip :text="isExpanded ? '' : t('home.settingsTitle')" placement="right">
            <button class="settings-btn" :class="{ 'is-active': route.name === 'settings' }" type="button" @click="onShowModelSettings">
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
              <button
                class="btn"
                :class="chatActionConfirm.danger ? 'btn-error' : 'btn-primary'"
                type="button"
                @click="resolveChatActionConfirmation(true)"
              >
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
import { useStore } from "vuex";
import { getChatList, deleteChat, renameChat, resetCurrentChatDraft } from "@/services";
import { deleteImageConversation, getImageConversationList } from "@/services/image";
import { nextTick, ref, computed, onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { setAppLocale } from "@/i18n";
import { applyTheme, getStoredTheme } from "@/utils/theme";
import brandIcon from "@/assets/svg/app18.svg";
import newIcon from "@/assets/svg/new24.svg";
import settingIcon from "@/assets/svg/setting24.svg";
import libraryIcon from "@/assets/svg/navImage24.svg";
import collapseIcon from "@/assets/svg/collapse24.svg";
import expandIcon from "@/assets/svg/expand24.svg";
import editIcon from "@/assets/svg/edit24.svg";
import deleteIcon from "@/assets/svg/delete16.svg";
import AppDropdownMenu from "@/components/AppDropdownMenu.vue";
import SvgIcon from "@/components/SvgIcon.vue";
import AppTooltip from "@/components/AppTooltip.vue";

const props = defineProps({
  expanded: { type: Boolean, default: true },
});

const emit = defineEmits(["toggle"]);
const store = useStore();
const router = useRouter();
const route = useRoute();
const { t, locale } = useI18n();

const isExpanded = computed(() => props.expanded);
const chatList = computed(() => [...store.state.chatList].reverse());
const imageConversationList = computed(() => [...(store.state.imageConversationList || [])].reverse());
const activeRouteChatId = computed(() => (route.name === "chat" && typeof route.params.cid === "string" ? route.params.cid : ""));
const activeRouteImageId = computed(() => (route.name === "image" && typeof route.params.iid === "string" ? route.params.iid : ""));
const isChatDraftRoute = computed(() => route.name === "chat" && !activeRouteChatId.value);
const isImageDraftRoute = computed(() => route.name === "image" && !activeRouteImageId.value);

const isShowOptionCid = ref("");
const isEditChatName = ref(false);
const isChatSectionOpen = ref(true);
const isImageSectionOpen = ref(true);
const isDeleteMode = ref(false);
const currentTheme = ref(getStoredTheme());
const editChatName = ref("");
const originalChatName = ref("");
const editChatNameInputElRef = ref<HTMLInputElement[] | null>(null);
const selectedChatIds = ref<string[]>([]);
const selectedImageConversationIds = ref<string[]>([]);
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
const selectedConversationCount = computed(() => selectedChatIds.value.length + selectedImageConversationIds.value.length);
const runningStatuses = new Set(["loading", "streaming"]);
const completedStatuses = new Set(["success", "error", "stopped"]);

const getChatRuntime = (cid: string) => store.state.chatRuntimeById?.[cid] || null;
const getImageRuntime = (iid: string) => store.state.imageRuntimeById?.[iid] || null;

const isRuntimeRunning = (runtime: any) => Boolean(runtime?.pending || runningStatuses.has(runtime?.status || ""));
const isRuntimeCompletedNotice = (runtime: any) => Boolean(runtime?.completedNotice && completedStatuses.has(runtime?.status || ""));

const hasChatRuntimeStatus = (cid: string) => {
  const runtime = getChatRuntime(cid);
  return isRuntimeRunning(runtime) || isRuntimeCompletedNotice(runtime);
};

const hasImageRuntimeStatus = (iid: string) => {
  const runtime = getImageRuntime(iid);
  return isRuntimeRunning(runtime) || isRuntimeCompletedNotice(runtime);
};

const getRuntimeStatusClass = (runtime: any) => ({
  "is-running": isRuntimeRunning(runtime),
  "is-complete": isRuntimeCompletedNotice(runtime) && runtime?.status === "success",
  "is-error": isRuntimeCompletedNotice(runtime) && runtime?.status === "error",
  "is-stopped": isRuntimeCompletedNotice(runtime) && runtime?.status === "stopped",
});

const getChatRuntimeStatusClass = (cid: string) => getRuntimeStatusClass(getChatRuntime(cid));
const getImageRuntimeStatusClass = (iid: string) => getRuntimeStatusClass(getImageRuntime(iid));

const getRuntimeLabel = (runtime: any) => {
  if (isRuntimeRunning(runtime)) return "Running";
  if (runtime?.status === "error") return "Finished with error";
  if (runtime?.status === "stopped") return "Stopped";
  return "Completed";
};

const getChatRuntimeLabel = (cid: string) => getRuntimeLabel(getChatRuntime(cid));
const getImageRuntimeLabel = (iid: string) => getRuntimeLabel(getImageRuntime(iid));

watch(chatList, (items) => {
  const ids = new Set(items.map((item) => item.cid));
  selectedChatIds.value = selectedChatIds.value.filter((id) => ids.has(id));
});

watch(imageConversationList, (items) => {
  const ids = new Set(items.map((item) => item.iid));
  selectedImageConversationIds.value = selectedImageConversationIds.value.filter((id) => ids.has(id));
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

const onShowModelSettings = () => router.push({ name: "settings" });

const onNewImage = async () => {
  await router.push({ name: "image" });
};

const onSelectImageConversation = async (item: any) => {
  if (item.iid === activeRouteImageId.value) return;
  await router.push({ name: "image", params: { iid: item.iid } });
};

const onSelectChat = async (item: any) => {
  if (item.cid === activeRouteChatId.value) return;
  await router.push({ name: "chat", params: { cid: item.cid } });
};

const clearSelectedConversations = () => {
  selectedChatIds.value = [];
  selectedImageConversationIds.value = [];
};

const selectAllConversations = () => {
  selectedChatIds.value = chatList.value.map((item) => item.cid);
  selectedImageConversationIds.value = imageConversationList.value.map((item) => item.iid);
};

const toggleDeleteMode = () => {
  isDeleteMode.value = !isDeleteMode.value;
  if (!isDeleteMode.value) clearSelectedConversations();
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
  const total = chatIds.length + imageIds.length;
  if (!total) return;

  const confirmed = await requestChatActionConfirmation({
    title: "Delete selected conversations",
    message: `Delete ${total} selected conversation${total > 1 ? "s" : ""}? This cannot be undone.`,
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
  if (chatIds.includes(activeRouteChatId.value)) {
    await router.replace({ name: "chat" });
  } else if (imageIds.includes(activeRouteImageId.value)) {
    await router.replace({ name: "image" });
  }
  clearSelectedConversations();
  isDeleteMode.value = false;
  isShowOptionCid.value = "";
};

const onDeleteImageConversation = async (item: any, closeMenu: () => void) => {
  closeMenu?.();
  const imageId = item?.iid || "";
  const confirmed = await requestChatActionConfirmation({
    title: "Delete image conversation",
    message: `Delete "${item?.iname || ""}"? This cannot be undone.`,
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
});
</script>

<style lang="scss" scoped>
$sidebar-w-collapsed: 68px;
$sidebar-w-expanded: 280px;
$radius-md: 12px;

.sidebar-container {
  height: 100%;
  flex: 0 0 auto;
  width: $sidebar-w-collapsed;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(18px);
  border-right: 1px solid rgba(17, 24, 39, 0.08);
  box-shadow: 1px 0 0 rgba(255, 255, 255, 0.72) inset;
  overflow: hidden;
  transition:
    width 0.22s ease,
    background-color 0.22s ease,
    border-color 0.22s ease;

  &.is-expanded {
    width: $sidebar-w-expanded;
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
      width: 44px;
      min-width: 44px;
      padding: 0;
      flex: 0 0 44px;
      justify-content: center;
    }

    .quick-control-btn {
      width: 44px;
      height: 44px;
    }

    .quick-controls {
      align-items: center;
      flex-direction: column;
    }

    .settings-shell {
      flex: 0 0 auto;

      :deep(.app-tooltip-host),
      :deep(.app-tooltip-trigger) {
        width: 44px;
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
  height: 44px;
  margin-bottom: 20px;
  gap: 8px;
}

.brand-logo {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  height: 44px;
  padding: 0 10px;
  border: none;
  background: transparent;
  color: #111827;
  font-weight: 600;
  font-size: 15px;
  cursor: pointer;
  border-radius: $radius-md;

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
  width: 44px;
  height: 44px;
  border: none;
  border-radius: $radius-md;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #4b5563;
  flex-shrink: 0;
  transition:
    background-color 0.16s ease,
    color 0.16s ease,
    transform 0.16s ease;

  &:hover {
    background: rgba(17, 24, 39, 0.06);
    color: #111827;
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
  height: 44px;
  padding: 0 12px;
  border: none;
  border-radius: $radius-md;
  background: transparent;
  display: flex;
  align-items: center;
  color: #374151;
  font-size: 14px;
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
    background: rgba(17, 24, 39, 0.05);
    color: #111827;
  }

  &:active {
    transform: scale(0.98);
  }

  &.is-active {
    background: #eef2ff;
    color: #1d4ed8;
    font-weight: 600;
  }
}

.nav-delete-panel {
  margin-top: 2px;
}

.nav-delete-btn {
  width: 100%;
  min-height: 36px;
  padding: 0 12px;
  border: none;
  border-radius: $radius-md;
  background: transparent;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    background: #fef2f2;
    color: #b91c1c;
  }

  .nav-icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }
}

.nav-delete-panel.is-active .nav-delete-btn {
  background: #fef2f2;
  color: #b91c1c;
}

.delete-mode-toolbar {
  display: grid;
  grid-template-columns: 1fr 1fr 1.4fr;
  gap: 6px;
  margin: 6px 0 4px;
  padding: 6px;
  border-radius: 12px;
  background: rgba(17, 24, 39, 0.04);

  button {
    min-height: 30px;
    padding: 0 8px;
    border: none;
    border-radius: 8px;
    background: #ffffff;
    color: #4b5563;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;

    &:hover:not(:disabled) {
      background: #f3f4f6;
      color: #111827;
    }

    &:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    &.is-danger {
      background: #dc2626;
      color: #ffffff;

      &:hover:not(:disabled) {
        background: #b91c1c;
        color: #ffffff;
      }
    }
  }
}

.sidebar-container:not(.is-expanded) .nav-group :deep(.app-tooltip-host),
.sidebar-container:not(.is-expanded) .nav-group :deep(.app-tooltip-trigger) {
  width: 44px;
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
  padding-right: 2px;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(17, 24, 39, 0.12);
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
  color: #9ca3af;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  text-align: left;
  transition:
    background-color 0.16s ease,
    color 0.16s ease;

  &:hover {
    background: rgba(17, 24, 39, 0.04);
    color: #6b7280;
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
  background: #f3f4f6;
  color: #6b7280;
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
  color: #9ca3af;
  font-size: 13px;
}

.chat-item-wrapper {
  width: 100%;
}

.chat-item {
  position: relative;
  display: flex;
  align-items: center;
  height: 44px;
  border-radius: $radius-md;
  padding: 0 4px;
  color: #374151;
  transition:
    background-color 0.16s ease,
    color 0.16s ease;

  &:hover,
  &.is-active,
  &.is-selected {
    background: #eef2ff;
    color: #111827;

    .chat-menu-btn {
      opacity: 1;
    }
  }

  &.is-active .chat-title-text {
    font-weight: 600;
    color: #1d4ed8;
  }
}

.row-select-checkbox {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
  margin: 0 0 0 4px;
  accent-color: #2563eb;
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
  font-size: 13px;
  text-align: left;
  color: #374151;
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
    background: #6b7280;
  }
}

.session-status-dot {
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  margin-right: 4px;
  border-radius: 999px;
  background: #2563eb;
  box-shadow: 0 0 0 2px #ffffff;

  &.is-running {
    background: #22c55e;
    animation: sessionStatusPulse 1.2s ease-in-out infinite;
  }

  &.is-error {
    background: #ef4444;
  }

  &.is-stopped {
    background: #94a3b8;
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
  height: 38px;
  padding: 0 10px;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: #374151;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
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
    color: #111827;
    outline: none;

    .menu-option-icon {
      color: #111827;
    }
  }

  &.is-danger {
    color: #dc2626;

    .menu-option-icon {
      color: #ef4444;
    }

    &:hover,
    &:focus-visible {
      background: #fef2f2;
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
  color: #6b7280;
  flex-shrink: 0;
  transition: color 0.16s ease;
}

.sidebar-action-confirm {
  // DaisyUI animates dialog backdrops by default; disable it here to avoid a visible mask flash.
  &::backdrop {
    background: rgba(17, 24, 39, 0.24);
    animation: none;
  }

  .modal-box {
    max-width: 420px;
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
  height: 36px;
  margin: 0 4px;
  padding: 0 10px;
  border: 1px solid #e4e4e7;
  border-radius: 8px;
  background: #fff;
  font-size: 13px;
  outline: none;
  box-sizing: border-box;

  &:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
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
  width: 36px;
  height: 44px;
  padding: 0;
  border: none;
  border-radius: $radius-md;
  background: transparent;
  color: #374151;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    background-color 0.16s ease,
    color 0.16s ease,
    transform 0.16s ease;

  &:hover {
    background: rgba(17, 24, 39, 0.05);
    color: #111827;
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
  height: 44px;
  padding: 0 12px;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  justify-content: flex-start;
  cursor: pointer;
  border-radius: $radius-md;
  color: #374151;
  transition:
    background-color 0.16s ease,
    color 0.16s ease,
    transform 0.16s ease;

  &:hover,
  &.is-active {
    background: rgba(17, 24, 39, 0.05);
    color: #111827;
  }

  &.is-active {
    background: #eef2ff;
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

@media (max-width: 768px) {
  .sidebar-container {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 100;
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(20px);

    &:not(.is-expanded) {
      width: 0;
      border-right: none;
    }
  }
}
</style>
