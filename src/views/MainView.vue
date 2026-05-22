<template>
  <div class="main-view-shell">
    <div class="main-view-backdrop"></div>
    <div class="main-view-content">
      <LeftView :expanded="sidebarExpanded" @toggle="sidebarExpanded = !sidebarExpanded" />
      <RightView>
        <ChatCard v-show="path === '/chat'" />
        <SettingsView v-show="path === '/settings'" />
      </RightView>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import LeftView from "@/views/layout/LeftView.vue";
import RightView from "@/views/layout/RightView.vue";
import ChatCard from "./chat/ChatCard.vue";
import SettingsView from "./settings/SettingsView.vue";

const sidebarExpanded = ref(true);
const route = useRoute();
const path = computed(() => route.path);
</script>

<style lang="scss" scoped>
.main-view-shell {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #ffffff;
}

.main-view-backdrop {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 52% 36%, rgba(191, 224, 255, 0.75), rgba(191, 224, 255, 0.34) 18%, rgba(255, 255, 255, 0) 42%),
    radial-gradient(circle at 50% 50%, rgba(217, 235, 255, 0.7), rgba(255, 255, 255, 0) 52%), linear-gradient(180deg, #ffffff 0%, #fbfbfb 100%);
  filter: blur(10px);
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
