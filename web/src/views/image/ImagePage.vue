<template>
  <div class="image-page-container">
    <div class="image-page-header">
      <HeaderBar />
    </div>

    <div class="image-mode-bar">
      <div class="image-mode-tabs">
        <button
          v-for="item in modeTabs"
          :key="item.key"
          type="button"
          class="image-mode-tab"
          :class="{ active: activeMode === item.key }"
          @click="activeMode = item.key"
        >
          <span>{{ item.label }}</span>
          <small>{{ item.description }}</small>
        </button>
      </div>
    </div>

    <div class="image-page-content">
      <component
        :is="activeComponent"
        :initial-edit-image="pendingEditImage"
        @switch-to-edit="switchToEdit"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import HeaderBar from "@/components/HeaderBar.vue";
import ImageGenerationPage from "@/views/image/ImageGenerationPage.vue";
import ImageEditPage from "@/views/image/ImageEditPage.vue";

const { t } = useI18n();

const activeMode = ref("generation");
const modeTabs = computed(() => [
  { key: "generation", label: t("image.generationTitle"), description: t("image.generationDescription") },
  { key: "edit", label: t("image.editTitle"), description: t("image.editDescription") },
]);
const activeComponent = computed(() => (activeMode.value === "edit" ? ImageEditPage : ImageGenerationPage));
const pendingEditImage = ref(null);

function switchToEdit(image = null) {
  pendingEditImage.value = image;
  activeMode.value = "edit";
}
</script>

<style lang="scss" scoped>
.image-page-container {
  --image-header-height: 48px;
  --image-mode-height: 64px;
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background:
    radial-gradient(circle at top left, oklch(var(--p) / 0.05), transparent 26%),
    radial-gradient(circle at bottom right, oklch(var(--a) / 0.05), transparent 28%),
    linear-gradient(180deg, oklch(var(--b2) / 0.96), oklch(var(--b1)));
}

.image-page-header {
  height: var(--image-header-height);
  flex: 0 0 auto;
}

.image-mode-bar {
  flex: 0 0 var(--image-mode-height);
  display: flex;
  align-items: center;
  padding: 10px 14px 0;
}

.image-mode-tabs {
  display: inline-grid;
  grid-template-columns: repeat(2, minmax(0, 190px));
  gap: 8px;
}

.image-mode-tab {
  height: 54px;
  min-width: 0;
  border: 1px solid oklch(var(--bc) / 0.08);
  border-radius: 8px;
  padding: 8px 10px;
  text-align: left;
  background: oklch(var(--b1) / 0.78);
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;

  span {
    font-size: 13px;
    font-weight: 800;
    line-height: 1.15;
  }

  small {
    min-width: 0;
    color: oklch(var(--bc) / 0.58);
    font-size: 11px;
    line-height: 1.2;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &.active {
    border-color: oklch(var(--p) / 0.28);
    background: oklch(var(--p) / 0.08);
  }
}

.image-page-content {
  flex: 1 1 auto;
  min-height: 0;
}

@media (max-width: 720px) {
  .image-page-container {
    --image-mode-height: 118px;
  }

  .image-mode-tabs {
    width: 100%;
    grid-template-columns: 1fr;
  }
}
</style>
