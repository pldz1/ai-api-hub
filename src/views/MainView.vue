<template>
  <div class="main-view-shell">
    <button
      v-if="!isSidebarHidden && isMobile && sidebarExpanded"
      class="main-view-mask"
      type="button"
      aria-label="Close sidebar"
      @click="sidebarExpanded = false"
    ></button>
    <button v-if="!isSidebarHidden && isMobile && !sidebarExpanded" class="sidebar-fab" type="button" aria-label="Open sidebar" @click="sidebarExpanded = true">
      <SvgIcon :src="menuIcon" />
    </button>
    <div class="main-view-content">
      <LeftView v-if="!isSidebarHidden" :expanded="sidebarExpanded" @toggle="sidebarExpanded = !sidebarExpanded" />
      <div class="main-view-stage">
        <RightView>
          <ChatIndex v-if="routeName === 'chat'" />
          <ImageIndex v-else-if="routeName === 'image'" />
          <VideoIndex v-else-if="routeName === 'video'" />
          <router-view v-else />

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
import ChatIndex from "@/views/chat/ChatIndex.vue";
import ImageIndex from "@/views/image/ImageIndex.vue";
import VideoIndex from "@/views/video/VideoIndex.vue";

import menuIcon from "@/assets/svg/menu32.svg";

const sidebarExpanded = ref(true);
const isMobile = ref(false);
const route = useRoute();
const routeName = computed(() => route.name);
const isSidebarHidden = computed(() => route.meta.hideSidebar === true);

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

.main-view-mask {
  display: none;
}

.main-view-content {
  position: relative;
  height: 100%;
  min-height: 0;
  min-width: 0;
  display: flex;
  overflow: hidden;
}

.main-view-stage {
  flex: 1 1 auto;
  height: 100%;
  min-height: 0;
  min-width: 0;
  box-sizing: border-box;
  overflow: hidden;
  contain: layout paint style;
}

.sidebar-fab {
  display: none;
}

@media (max-width: 768px) {
  .main-view-mask {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 90;
    border: 0;
    background: oklch(var(--bc) / 0.28);
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
