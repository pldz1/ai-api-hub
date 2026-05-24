<template>
  <aside class="sidebar-container" :class="{ 'is-expanded': isExpanded }">
    <div class="sidebar-wrapper">
      <!-- Header: Logo and Toggle Button -->
      <div class="sidebar-header" v-if="isExpanded">
        <a class="brand-logo" href="/login">
          <SvgIcon class="logo-icon" :src="brandIcon" colored />
          <span class="logo-text">AI API HUB · v0.0.1</span>
        </a>

        <AppTooltip :text="t('chat.sidebarToggle')" placement="right">
          <button class="collapse-btn" type="button" :aria-label="t('chat.sidebarToggle')" @click="emit('toggle')">
            <SvgIcon :src="collapseIcon" />
          </button>
        </AppTooltip>
      </div>
      <div v-else class="sidebar-header sidebar-header-collapsed">
        <AppTooltip :text="t('chat.sidebarToggle')" placement="right">
          <button class="collapse-btn" type="button" :aria-label="t('chat.sidebarToggle')" @click="emit('toggle')">
            <SvgIcon :src="expandIcon" />
          </button>
        </AppTooltip>
      </div>

      <!-- Main Navigation -->
      <nav class="nav-group">
        <button class="nav-item" type="button" @click="onNewChat">
          <SvgIcon :src="newIcon" class="nav-icon" />
          <span v-if="isExpanded" class="nav-label">New chat conversation</span>
        </button>
        <button class="nav-item" type="button">
          <SvgIcon :src="libraryIcon" class="nav-icon" />
          <span v-if="isExpanded" class="nav-label">New image creation</span>
        </button>
      </nav>

      <!-- Recent Chats -->
      <div v-if="isExpanded" class="sidebar-section recents-section">
        <div class="section-title">Chat Conversations</div>
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
            <div v-else class="chat-item" :class="{ 'is-active': cid === item.cid }">
              <button class="chat-main-btn" type="button" @click="onSelectChat(item)">
                <span class="chat-title-text">{{ item.cname }}</span>
              </button>

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

      <div class="sidebar-footer">
        <div class="settings-btn" @click="onShowModelSettings">
          <SvgIcon :src="settingIcon" style="width: 24px; height: 24px" />
          <span v-if="isExpanded">{{ t("home.settingsTitle") }}</span>
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
import { nextTick, ref, computed, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
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
const { t } = useI18n();

const isExpanded = computed(() => props.expanded);
const cid = computed(() => store.state.curChatId);
const chatList = computed(() => [...store.state.chatList].reverse());
const activeRouteChatId = computed(() => (typeof route.params.cid === "string" ? route.params.cid : ""));

const isShowOptionCid = ref("");
const isEditChatName = ref(false);
const editChatName = ref("");
const originalChatName = ref("");
const editChatNameInputElRef = ref<HTMLInputElement[] | null>(null);
const chatActionConfirmDialogRef = ref<HTMLDialogElement | null>(null);
const chatActionConfirm = ref({
  title: "",
  message: "",
  confirmText: "",
  danger: false,
});
const isRenameSubmitting = ref(false);
let chatActionConfirmResolve: ((confirmed: boolean) => void) | null = null;

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

const onSelectChat = async (item: any) => {
  if (item.cid === activeRouteChatId.value) return;
  await router.push({ name: "chat", params: { cid: item.cid } });
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
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(24px);
  border-right: 1px solid rgba(0, 0, 0, 0.06);
  overflow: hidden;

  &.is-expanded {
    width: $sidebar-w-expanded;
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
}

.sidebar-header-collapsed {
  justify-content: center;
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

  &:hover {
    background: rgba(0, 0, 0, 0.05);
    color: #111827;
  }
}

.nav-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
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
    background: rgba(0, 0, 0, 0.04);
    color: #111827;
  }
}

.sidebar-section {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;

  .section-title {
    padding: 0 12px;
    color: #9ca3af;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 6px;
  }
}

.recents-list {
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;

  &::-webkit-scrollbar {
    width: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 4px;
  }
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
  display: flex;
  align-items: center;
  height: 44px;
  border-radius: $radius-md;
  padding: 0 4px;

  &:hover,
  &.is-active {
    background: #e4e4e7;
    color: #111827;

    .chat-menu-btn {
      opacity: 1;
    }
  }

  &.is-active .chat-title-text {
    font-weight: 600;
  }
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
}

.settings-btn {
  padding: 8px 16px;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  justify-content: flex-start;
  cursor: pointer;
  border-radius: 16px;

  &:hover {
    background: rgba(0, 0, 0, 0.05);
    color: #111827;
  }

  svg {
    height: 32px;
    width: 32px;
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
