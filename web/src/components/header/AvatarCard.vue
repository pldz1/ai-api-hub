<template>
  <AppTooltip :text="tooltipText" placement="bottom">
    <div class="avatar placeholder" :class="statusClassMap">
      <div class="avatar-shell">
        <span class="avatar-text">{{ username }}</span>
      </div>
    </div>
  </AppTooltip>
</template>

<script setup>
import { computed } from "vue";
import { useStore } from "vuex";
import { useI18n } from "vue-i18n";
import AppTooltip from "@/components/base/AppTooltip.vue";
import { WORKSPACE_ID } from "@/store/user";

const store = useStore();
const { t } = useI18n();
const username = computed(() => {
  if (!store.state.username || store.state.username === WORKSPACE_ID) return "WS";
  return store.state.username.slice(0, 2).toUpperCase();
});
const storageMode = computed(() => store.state.storageMode || "unknown");

const status = computed(() => {
  if (storageMode.value === "browser") return "mock";
  if (storageMode.value === "server") return "online";
  return "offline";
});

const tooltipText = computed(() => {
  if (status.value === "mock") {
    return `${t("tooltip.userStatusLocalStorageTitle")}\n${t("tooltip.userStatusLocalStorageDescription")}`;
  }

  if (status.value === "online") {
    return `${t("tooltip.userStatusOnlineTitle")}\n${t("tooltip.userStatusOnlineDescription")}`;
  }

  return `${t("tooltip.userStatusOfflineTitle")}\n${t("tooltip.userStatusOfflineDescription")}`;
});

const statusClassMap = computed(() => ({
  online: status.value === "online",
  offline: status.value === "mock",
}));
</script>

<style scoped>
.avatar {
  cursor: pointer;
  color: oklch(var(--b2));
}

.avatar-shell {
  height: 32px;
  width: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at top left, oklch(var(--a) / 0.18), transparent 44%), linear-gradient(180deg, oklch(var(--b1) / 0.96), oklch(var(--b2) / 0.92));
  color: oklch(var(--bc));
  border: 1px solid oklch(var(--bc) / 0.12);
  box-shadow:
    inset 0 1px 0 oklch(var(--b1) / 0.9),
    0 10px 22px oklch(var(--bc) / 0.1);
  position: relative;
}

.avatar-text {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
}
</style>
