<template>
  <div class="main-view-shell">
    <div class="main-view-backdrop"></div>
    <div class="main-view-content">
      <LeftView :expanded="sidebarExpanded" @toggle="sidebarExpanded = !sidebarExpanded" />
      <RightView>
        <ChatIndex v-if="routeName === 'chat'" />
        <ImageIndex v-else-if="routeName === 'image'" />
        <SettingIndex v-else-if="routeName === 'settings'" />

        <template #footer>
          <AppFooter />
        </template>
      </RightView>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import LeftView from "@/views/layout/LeftView.vue";
import RightView from "@/views/layout/RightView.vue";
import AppFooter from "@/components/AppFooter.vue";
import ChatIndex from "./chat/ChatIndex.vue";
import ImageIndex from "./image/ImageIndex.vue";
import SettingIndex from "./setting/SettingIndex.vue";

const sidebarExpanded = ref(true);
const route = useRoute();
const routeName = computed(() => route.name);
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

.main-view-content {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: row;
}
</style>
