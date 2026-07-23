<template>
  <dialog ref="dialogRef" class="image-source-dialog" @click="onBackdropClick" @cancel.prevent="close">
    <section class="isd-panel" @click.stop>
      <header class="isd-header">
        <div>
          <h2>{{ t("mediaPicker.title") }}</h2>
          <p>{{ t("mediaPicker.description") }}</p>
        </div>
        <button class="isd-close" type="button" :aria-label="t('common.close')" @click="close">&times;</button>
      </header>

      <div class="isd-divider"><span>{{ t("mediaPicker.fromAssets") }}</span></div>

      <div v-if="loading" class="isd-state">{{ t("assets.loading") }}</div>
      <div v-else-if="error" class="isd-state is-error">{{ error }}</div>
      <div v-else-if="imageAssets.length" class="isd-asset-grid">
        <button
          v-for="asset in imageAssets"
          :key="asset.id"
          class="isd-asset"
          type="button"
          :disabled="selectingAssetId === asset.id"
          @click="chooseAsset(asset)"
        >
          <img :src="asset.src" :alt="asset.prompt || asset.id" loading="lazy" />
          <span>{{ asset.prompt || t("assets.untitledAsset") }}</span>
        </button>
      </div>
      <div v-else class="isd-state">{{ t("mediaPicker.noImageAssets") }}</div>

      <button class="isd-local-source" type="button" @click="chooseLocalFile">
        <SvgIcon :src="attachIcon" />
        <span>
          <strong>{{ t("mediaPicker.localFile") }}</strong>
          <small>{{ t("mediaPicker.localFileDescription") }}</small>
        </span>
      </button>
    </section>
  </dialog>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import SvgIcon from "@/components/SvgIcon.vue";
import attachIcon from "@/assets/svg/attach24.svg";
import { getGeneratedAssets, type GeneratedAssetItem } from "@/services/creation/asset";

const emit = defineEmits<{
  select: [file: File];
  local: [];
}>();

const { t } = useI18n();
const dialogRef = ref<HTMLDialogElement | null>(null);
const imageAssets = ref<GeneratedAssetItem[]>([]);
const loading = ref(false);
const error = ref("");
const selectingAssetId = ref("");

function extensionForType(contentType: string) {
  if (contentType === "image/jpeg") return "jpg";
  if (contentType === "image/webp") return "webp";
  if (contentType === "image/gif") return "gif";
  return "png";
}

async function loadAssets() {
  loading.value = true;
  error.value = "";
  try {
    imageAssets.value = (await getGeneratedAssets()).filter((asset) => asset.kind === "image" && Boolean(asset.src));
  } catch (cause) {
    imageAssets.value = [];
    error.value = cause instanceof Error ? cause.message : t("assets.loadFailed");
  } finally {
    loading.value = false;
  }
}

async function open() {
  dialogRef.value?.showModal();
  await loadAssets();
}

function close() {
  if (dialogRef.value?.open) dialogRef.value.close();
  selectingAssetId.value = "";
}

function chooseLocalFile() {
  close();
  emit("local");
}

async function chooseAsset(asset: GeneratedAssetItem) {
  if (selectingAssetId.value) return;
  selectingAssetId.value = asset.id;
  try {
    const response = await fetch(asset.src);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const contentType = blob.type || "image/png";
    emit("select", new File([blob], `asset-${asset.id}.${extensionForType(contentType)}`, { type: contentType }));
    close();
  } catch (cause) {
    error.value = t("mediaPicker.assetReadFailed", {
      error: cause instanceof Error ? cause.message : String(cause),
    });
  } finally {
    selectingAssetId.value = "";
  }
}

function onBackdropClick(event: MouseEvent) {
  if (event.target === dialogRef.value) close();
}

defineExpose({ open, close });
</script>

<style scoped lang="scss">
.image-source-dialog {
  width: min(680px, calc(100vw - 28px));
  max-width: none;
  max-height: min(760px, calc(100dvh - 28px));
  margin: auto;
  padding: 0;
  overflow: hidden;
  border: 1px solid oklch(var(--bc) / 0.12);
  border-radius: 18px;
  background: oklch(var(--b1));
  color: oklch(var(--bc));
  box-shadow: 0 28px 90px rgba(0, 0, 0, 0.24);

  &::backdrop {
    background: rgba(15, 18, 24, 0.5);
    backdrop-filter: blur(3px);
  }
}

.isd-panel {
  max-height: min(760px, calc(100dvh - 28px));
  display: flex;
  flex-direction: column;
  padding: 22px;
}

.isd-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;

  h2 { margin: 0; font-size: 20px; }
  p { margin: 6px 0 0; color: oklch(var(--bc) / 0.56); font-size: 13px; }
}

.isd-close {
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  border: 0;
  border-radius: 999px;
  background: oklch(var(--bc) / 0.06);
  color: inherit;
  font-size: 23px;
  cursor: pointer;
}

.isd-local-source {
  width: 100%;
  min-height: 72px;
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 20px;
  padding: 14px 16px;
  border: 1px solid oklch(var(--bc) / 0.12);
  border-radius: 14px;
  background: oklch(var(--b2) / 0.45);
  color: inherit;
  text-align: left;
  cursor: pointer;

  &:hover { border-color: oklch(var(--p) / 0.42); background: oklch(var(--p) / 0.08); }
  :deep(.svg-icon) { width: 24px; height: 24px; flex: 0 0 auto; }
  span { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  strong { font-size: 14px; }
  small { color: oklch(var(--bc) / 0.52); font-size: 12px; }
}

.isd-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 20px 0 12px;
  color: oklch(var(--bc) / 0.48);
  font-size: 12px;

  &::before, &::after { content: ""; height: 1px; flex: 1; background: oklch(var(--bc) / 0.1); }
}

.isd-asset-grid {
  min-height: 0;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  padding: 2px;
}

.isd-asset {
  min-width: 0;
  padding: 0;
  overflow: hidden;
  border: 1px solid oklch(var(--bc) / 0.1);
  border-radius: 11px;
  background: oklch(var(--b2) / 0.3);
  color: inherit;
  text-align: left;
  cursor: pointer;

  &:hover { border-color: oklch(var(--p) / 0.52); box-shadow: 0 8px 24px oklch(var(--bc) / 0.1); }
  &:disabled { opacity: 0.55; cursor: wait; }
  img { display: block; width: 100%; aspect-ratio: 1; object-fit: cover; background: oklch(var(--b2)); }
  span { display: block; padding: 8px; overflow: hidden; color: oklch(var(--bc) / 0.7); font-size: 11px; white-space: nowrap; text-overflow: ellipsis; }
}

.isd-state {
  min-height: 132px;
  display: grid;
  place-items: center;
  color: oklch(var(--bc) / 0.52);
  font-size: 13px;

  &.is-error { color: oklch(var(--er)); }
}

@media (max-width: 620px) {
  .isd-panel { padding: 18px; }
  .isd-asset-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
</style>
