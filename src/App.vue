<template>
  <div class="app-shell">
    <main class="app-main">
      <router-view v-slot="{ Component }">
        <keep-alive>
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </main>
  </div>
  <input id="global-file-upload-input" type="file" style="display: none" />
</template>

<script setup>
import { computed, onMounted } from "vue";
import { useStore } from "vuex";
import { getModels, getImageList } from "@/services";

const store = useStore();

onMounted(async () => {
  await store.dispatch("login");
  await getModels();
  await getImageList();
});
</script>

<style>
#app {
  position: fixed;
  inset: 0;
  min-height: 400px;
  font-family: "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", sans-serif;
  overflow: hidden;
  color: oklch(var(--bc));
  user-select: text;
}

.app-shell {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.app-main {
  flex: 1 1 auto;
  min-height: 0;
}
</style>
