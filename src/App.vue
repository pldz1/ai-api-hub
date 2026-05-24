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
  <ConfigConfirm ref="configImportConfirmDialogRef" />
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useStore } from "vuex";
import ConfigConfirm from "@/components/ConfigConfirm.vue";
import { getInitialRouteConfigValue, getModels, getImageList, importSettingsFromConfigValue } from "@/services";

const store = useStore();
const route = useRoute();
const configImportConfirmDialogRef = ref<{ confirm: () => Promise<boolean> } | null>(null);
const importedConfigValues = new Set<string>();

async function importRouteConfig(routeText = "") {
  const routeConfigValue = getInitialRouteConfigValue(routeText);
  if (!routeConfigValue || importedConfigValues.has(routeConfigValue)) return;

  const confirmed = await configImportConfirmDialogRef.value?.confirm();
  if (!confirmed) return;

  importedConfigValues.add(routeConfigValue);
  await importSettingsFromConfigValue(routeConfigValue);
}

onMounted(async () => {
  await store.dispatch("login");
  await getModels();
  await importRouteConfig();
  await getImageList();
});

watch(
  () => route.fullPath,
  async (fullPath) => {
    await importRouteConfig(fullPath);
  },
);
</script>

<style lang="scss">
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
