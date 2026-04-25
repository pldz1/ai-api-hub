<template>
  <div class="app-shell">
    <main class="app-main">
      <router-view v-slot="{ Component }">
        <keep-alive>
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </main>
    <AppFooter />
  </div>
  <input id="gloal-file-upload-input" type="file" style="display: none" />
</template>

<script setup>
import { onMounted } from "vue";
import { useStore } from "vuex";
import AppFooter from "@/components/AppFooter.vue";
import { getModels, getChatInsTemplateList, getImageList } from "@/services";

const store = useStore();

onMounted(async () => {
  await store.dispatch("login");
  await getModels();
  await getChatInsTemplateList();
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
  background:
    radial-gradient(circle at top left, oklch(var(--p) / 0.08), transparent 28%), radial-gradient(circle at top right, oklch(var(--a) / 0.08), transparent 26%),
    linear-gradient(180deg, oklch(var(--b1) / 0.98), oklch(var(--b2) / 0.96));
  /* 允许在webview中拷贝文字 */
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
