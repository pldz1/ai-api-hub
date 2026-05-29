<template>
  <div class="main-view-shell" :class="{ 'is-sidebar-open': sidebarExpanded }">
    <div class="main-view-backdrop"></div>
    <button v-if="isMobile && sidebarExpanded" class="main-view-mask" type="button" aria-label="Close sidebar" @click="sidebarExpanded = false"></button>
    <button v-if="isMobile && !sidebarExpanded" class="sidebar-fab" type="button" aria-label="Open sidebar" @click="sidebarExpanded = true">
      <SvgIcon :src="menuIcon" />
    </button>
    <div class="main-view-content">
      <LeftView :expanded="sidebarExpanded" :active-tab="settingsActiveTab" @toggle="sidebarExpanded = !sidebarExpanded" @update:active-tab="settingsActiveTab = $event" />
      <div class="main-view-stage">
        <RightView>
          <ChatIndex v-if="routeName === 'chat'" />
          <ImageIndex v-else-if="routeName === 'image'" />
          <SettingIndex v-else-if="routeName === 'settings'" :active-tab="settingsActiveTab" />

          <template #footer>
            <AppFooter />
          </template>
        </RightView>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import LeftView from "@/views/layout/LeftView.vue";
import RightView from "@/views/layout/RightView.vue";
import AppFooter from "@/components/AppFooter.vue";
import SvgIcon from "@/components/SvgIcon.vue";
import ChatIndex from "./chat/ChatIndex.vue";
import ImageIndex from "./image/ImageIndex.vue";
import SettingIndex from "./setting/SettingIndex.vue";
type SettingTabKey_M = "chat-templates" | "chat-models" | "image-models" | "app";

import menuIcon from "@/assets/svg/menu32.svg";

const sidebarExpanded = ref(true);
const isMobile = ref(false);
const route = useRoute();
const routeName = computed(() => route.name);
const settingsActiveTab = ref<SettingTabKey_M>("chat-models");

let mobileQuery: MediaQueryList | null = null;
const handleMobileQueryChange = (event: MediaQueryListEvent) => {
  isMobile.value = event.matches;
  if (event.matches) sidebarExpanded.value = false;
};

onMounted(() => {
  mobileQuery = window.matchMedia("(max-width: 768px)");
  isMobile.value = mobileQuery.matches;
  if (mobileQuery.matches) sidebarExpanded.value = false;
  mobileQuery.addEventListener("change", handleMobileQueryChange);
});

onBeforeUnmount(() => {
  mobileQuery?.removeEventListener("change", handleMobileQueryChange);
});
</script>

<style lang="scss" scoped>
.main-view-shell {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: oklch(var(--b1));
}

.main-view-backdrop {
  position: absolute;
  inset: 0;
  transform: scale(1.08);
  pointer-events: none;
}

.main-view-mask {
  display: none;
}

.main-view-content {
  position: relative;
  height: 100%;
  min-width: 0;
}

.main-view-stage {
  height: 100%;
  min-width: 0;
  padding-left: 68px;
  box-sizing: border-box;
  transition: padding-left 0.22s ease;
}

.main-view-shell.is-sidebar-open .main-view-stage {
  padding-left: 280px;
}

.sidebar-fab {
  display: none;
}

@media (max-width: 768px) {
  .main-view-stage,
  .main-view-shell.is-sidebar-open .main-view-stage {
    padding-left: 0;
  }

  .main-view-mask {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 90;
    border: 0;
    background: oklch(var(--bc) / 0.28);
    backdrop-filter: blur(2px);
  }

  .sidebar-fab {
    display: inline-flex;
    position: fixed;
    left: 16px;
    top: 16px;
    z-index: 95;
    width: 32px;
    height: 32px;
    border: 0;
    border-radius: 999px;
    align-items: center;
    justify-content: center;
    background: oklch(var(--bc) / 0.08);
    color: oklch(var(--bc));
    font-size: 14px;
    font-weight: 700;
  }
}
</style>
