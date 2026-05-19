<template>
  <div class="chat-sidebar-container" :class="{ expanded: isShowChatScrollbar }">
    <div class="csdb-sidebar">
      <div class="csdb-chat-list">
        <AppTooltip :text="t('chat.sidebarToggle')" placement="right">
          <button class="btn csdb-btn-wh1 csdb-btn-color1" @click="onShowSidebar">
            <SvgIcon :src="sidebarIcon" />
          </button>
        </AppTooltip>
        <AppTooltip :text="t('chat.newChat')" placement="right">
          <button class="btn csdb-btn-wh1 csdb-btn-color1" @click="onNewChat">
            <SvgIcon :src="newIcon" />
          </button>
        </AppTooltip>
      </div>
      <AppTooltip :text="t('chat.modelSettings')" placement="right">
        <button class="btn csdb-btn-wh1 csdb-btn-color1" @click="onShowModelSettings">
          <SvgIcon :src="settingIcon" />
        </button>
      </AppTooltip>
    </div>
    <div v-if="isShowChatScrollbar" class="csdb-chats">
      <div v-if="chatList.length == 0" class="csdb-chats-container">
        <h2 class="font-bold">
          {{ t("chat.noChats") }}
          <br />
        </h2>
      </div>
      <div v-else class="csdb-chats-container">
        <div v-for="item in chatList" :key="item.cid">
          <input
            v-if="isShowOptionCid == item.cid && isEditChatName"
            v-model="editChatName"
            @blur="changeChatName"
            @keydown.enter="changeChatName"
            type="text"
            class="input input-bordered"
            ref="editChatNameInputElRef"
          />
          <div v-else :class="['csdb-chat-item', { 'csdb-chat-item-active': cid === item.cid }]">
            <button class="csdb-chat-main" type="button" @click="onSelectChat(item)">
              <span :class="['csdb-chat-status', `is-${resolveChatStatus(item.cid)}`]">
                <span v-if="resolveChatStatus(item.cid) === 'loading'" class="csdb-chat-spinner"></span>
                <SvgIcon v-else-if="resolveChatStatus(item.cid) === 'success'" :src="successIcon" />
                <SvgIcon v-else-if="resolveChatStatus(item.cid) === 'error'" :src="errorIcon" />
                <SvgIcon v-else-if="resolveChatStatus(item.cid) === 'stopped'" :src="pauseIcon" />
                <span v-else class="csdb-chat-dot"></span>
              </span>
              <span class="csdb-chat-label">
                {{ item.cname }}
              </span>
            </button>
            <AppDropdownMenu placement="bottom-end">
              <template #trigger="{ toggle, open }">
                <div class="csdb-chat-dropdown">
                  <button class="btn" :class="{ open }" :aria-label="t('chat.moreActions')" @click.stop="toggle">
                    <SvgIcon :src="optionsIcon" />
                  </button>
                </div>
              </template>
              <template #default="{ close }">
                <button class="csdb-chat-option" @click="onEditChatName(item.cid, close)">
                  <div class="csdb-chat-option-copy">
                    <span>{{ t("chat.renameChat") }}</span>
                  </div>
                </button>
                <button class="csdb-chat-option csdb-chat-option-danger" @click="onDeleteChat(item.cid, close)">
                  <div class="csdb-chat-option-copy">
                    <span>{{ t("chat.deleteChat") }}</span>
                  </div>
                </button>
              </template>
            </AppDropdownMenu>
          </div>
        </div>
      </div>
    </div>
  </div>
  <ChatSettings></ChatSettings>
</template>

<script setup>
import { useStore } from "vuex";
import { nextTick, ref, computed } from "vue";
import { useI18n } from "vue-i18n";
import optionsIcon from "@/assets/svg/options24.svg";
import sidebarIcon from "@/assets/svg/sidebar24.svg";
import newIcon from "@/assets/svg/new24.svg";
import settingIcon from "@/assets/svg/setting24.svg";
import successIcon from "@/assets/svg/success24.svg";
import errorIcon from "@/assets/svg/error24.svg";
import pauseIcon from "@/assets/svg/pause32.svg";
import { deleteChat, renameChat } from "@/services";
import { buildDefaultChatSettings, getModelRequestId } from "@/models";
import ChatSettings from "@/views/chat/components/ChatSettings.vue";
import { dsAlert } from "@/utils";
import AppTooltip from "@/components/AppTooltip.vue";
import AppDropdownMenu from "@/components/AppDropdownMenu.vue";
import SvgIcon from "@/components/SvgIcon.vue";

const store = useStore();
const { t } = useI18n();
const cid = computed(() => store.state.curChatId);
const chatList = computed(() => [...store.state.chatList].reverse());

const isShowOptionCid = ref("");
const isEditChatName = ref(false);
const editChatName = ref("");
const editChatNameInputElRef = ref(null);
const isShowChatScrollbar = ref(true);
const curChatModel = computed(() => store.state.curChatModel);
const curConversation = computed(() => store.state.curConversation);
const hasSelectedChatModel = computed(() => Boolean(curConversation.value?.modelSnapshot || getModelRequestId(curChatModel.value)));

const resolveChatStatus = (chatId) => {
  const runtime = store.state.chatRuntimeById?.[chatId];
  if (!runtime) return "idle";
  if (runtime.pending || runtime.status === "loading" || runtime.status === "streaming") return "loading";
  if (runtime.status === "error") return "error";
  if (runtime.status === "stopped") return "stopped";
  if (runtime.status === "success") return "success";
  return "idle";
};

const onShowSidebar = () => {
  isShowChatScrollbar.value = !isShowChatScrollbar.value;
};

const onNewChat = async () => {
  await store.dispatch("setCurChatModelSettings", buildDefaultChatSettings(curChatModel.value));
  await store.dispatch("setCurChatId", "");
  await store.dispatch("setCurConversation", null);
};

const onShowModelSettings = () => {
  if (!hasSelectedChatModel.value) {
    dsAlert({ type: "warn", message: t("chat.chooseModelFirst") });
    return;
  }
  global_chat_model_settings.showModal();
};

const onSelectChat = async (item) => {
  if (item.cid == cid.value) return;
  await store.dispatch("setCurChatId", item.cid);
};

const onDeleteChat = async (chatId, closeMenu) => {
  if (closeMenu) closeMenu();
  if (chatId) await deleteChat(chatId);
  isShowOptionCid.value = "";
  editChatName.value = "";
};

const onEditChatName = async (chatId, closeMenu) => {
  if (closeMenu) closeMenu();
  isShowOptionCid.value = chatId;
  isEditChatName.value = true;
  editChatName.value = "";
  await nextTick();
  if (editChatNameInputElRef?.value[0]) editChatNameInputElRef.value[0].focus();
};

const changeChatName = async () => {
  if (editChatName.value) await renameChat(isShowOptionCid.value, editChatName.value);
  await nextTick();
  isEditChatName.value = false;
  editChatName.value = "";
  isShowOptionCid.value = "";
};
</script>

<style lang="scss" scoped>
.chat-sidebar-container {
  --sidebar-rail-width: 64px;
  --sidebar-panel-width: 272px;
  height: 100%;
  max-height: 100%;
  flex: 0 0 auto;
  width: var(--sidebar-rail-width);
  min-width: var(--sidebar-rail-width);
  max-width: var(--sidebar-rail-width);
  border: 1px solid oklch(var(--bc) / 0.12);
  border-radius: 28px;
  background: linear-gradient(180deg, oklch(var(--b1) / 0.88), oklch(var(--b2) / 0.84)), oklch(var(--b1) / 0.64);
  box-shadow: 0 20px 44px oklch(var(--bc) / 0.08);
  display: flex;
  flex-direction: row;
  overflow: hidden;
  contain: layout paint;
  will-change: width;
  transition: width 0.2s cubic-bezier(0.22, 1, 0.36, 1);

  &.expanded {
    width: calc(var(--sidebar-rail-width) + var(--sidebar-panel-width));
    min-width: calc(var(--sidebar-rail-width) + var(--sidebar-panel-width));
    max-width: calc(var(--sidebar-rail-width) + var(--sidebar-panel-width));
  }

  .csdb-sidebar {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 14px 10px;
    width: 64px;
    max-width: 64px;
    background: oklch(var(--b2) / 0.62);
    transition: border-color 0.18s ease;

    .csdb-btn-color1 {
      background: oklch(var(--b1) / 0.78);
      box-shadow: none;
      border: 1px solid oklch(var(--bc) / 0.12);
      border-radius: 14px;
      color: oklch(var(--bc));
      transition:
        transform 0.18s ease,
        border-color 0.18s ease,
        box-shadow 0.18s ease;

      &:hover {
        transform: translateY(-1px);
        background-color: oklch(var(--b1) / 0.96);
        border-color: oklch(var(--p) / 0.18);
        box-shadow: 0 10px 20px oklch(var(--bc) / 0.1);
      }
    }

    .csdb-btn-wh1 {
      height: 40px;
      width: 40px;
      min-height: 40px;

      :deep(.svg-icon) {
        width: 24px;
        height: 24px;
      }
    }

    .csdb-chat-list {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
  }

  &.expanded {
    .csdb-sidebar {
      border-right: 1px solid oklch(var(--bc) / 0.1);
    }
  }

  .csdb-chats {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 14px 12px;
    width: var(--sidebar-panel-width);
    max-width: var(--sidebar-panel-width);
    min-width: var(--sidebar-panel-width);
    overflow: hidden;

    .csdb-chats-container {
      background: oklch(var(--b1) / 0.42);
      height: 100%;
      width: 100%;
      text-align: center;
      max-height: 100%;
      overflow-x: hidden;
      overflow-y: auto;
      border-radius: 22px;
      padding: 10px;
      border: 1px solid oklch(var(--bc) / 0.1);

      h2 {
        display: flex;
        align-items: center;
        height: 100%;
        flex-direction: column;
        justify-content: center;
        gap: 8px;
      }
    }

    .input {
      height: 40px;
      width: 100%;
      border-radius: 14px;
      border: 1px solid rgba(113, 130, 84, 0.16);
      background: rgba(255, 255, 255, 0.88);

      &:focus,
      &:focus-within {
        border-color: rgba(92, 114, 49, 0.42);
        outline: none;
      }
    }

    .csdb-chat-item {
      height: 44px;
      min-height: 44px;
      width: 100%;
      border: 1px solid transparent;
      border-radius: 14px;
      background-color: transparent;
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      color: #20301b;
      margin-bottom: 6px;
      padding: 0 8px 0 12px;
      transition:
        background-color 0.18s ease,
        border-color 0.18s ease,
        transform 0.18s ease;

      &:hover {
        background-color: oklch(var(--b1) / 0.78);
        border-color: oklch(var(--bc) / 0.1);
        transform: translateY(-1px);
      }
    }

    .csdb-chat-item-active {
      background: linear-gradient(180deg, oklch(var(--p) / 0.1), oklch(var(--b1) / 0.9));
      border-color: oklch(var(--p) / 0.16);
      box-shadow: 0 10px 18px oklch(var(--bc) / 0.08);
      font-weight: 700;
    }

    .csdb-chat-main {
      min-width: 0;
      flex: 1 1 auto;
      display: flex;
      align-items: center;
      gap: 10px;
      border: none;
      background: transparent;
      padding: 0;
      color: inherit;
      cursor: pointer;
    }

    .csdb-chat-status {
      width: 18px;
      height: 18px;
      flex: 0 0 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: oklch(var(--bc) / 0.5);

      :deep(.svg-icon) {
        width: 16px;
        height: 16px;
      }

      &.is-success {
        color: oklch(var(--su));
      }

      &.is-error {
        color: oklch(var(--er));
      }

      &.is-stopped {
        color: oklch(var(--wa));
      }
    }

    .csdb-chat-spinner {
      width: 14px;
      height: 14px;
      border-radius: 999px;
      border: 2px solid oklch(var(--bc) / 0.16);
      border-top-color: oklch(var(--p));
      animation: csdb-spin 0.8s linear infinite;
    }

    .csdb-chat-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: oklch(var(--bc) / 0.18);
    }

    .csdb-chat-label {
      width: 100%;
      text-align: left;
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: oklch(var(--bc) / 0.72);
    }

    .csdb-chat-dropdown {
      display: inline-flex;

      .btn {
        height: 26px;
        width: 26px;
        min-height: 0px;
        min-width: 0px;
        background-color: transparent;
        border: none;
        box-shadow: initial;
        border-radius: 999px;
        color: oklch(var(--bc) / 0.64);
        transition:
          background-color 0.16s ease,
          color 0.16s ease,
          transform 0.16s ease,
          box-shadow 0.16s ease;

        &:hover,
        &.open {
          background: oklch(var(--b2) / 0.98);
          color: oklch(var(--bc));
          box-shadow: inset 0 0 0 1px oklch(var(--bc) / 0.08);
        }

        &:hover {
          transform: translateY(-1px) scale(1.02);
        }

        :deep(.svg-icon) {
          width: 24px;
          height: 24px;
        }
      }
    }
  }

  .csdb-chat-option-copy {
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    flex: 1 1 auto;
  }

  .csdb-chat-option-copy span {
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .csdb-chat-option-danger {
    margin-top: 2px;
    padding-top: 10px;
    border-top: 1px solid oklch(var(--bc) / 0.08);
    color: oklch(var(--er));

    &:hover {
      background: oklch(var(--er) / 0.09);
      color: oklch(var(--er));
    }
  }
}

@keyframes csdb-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
