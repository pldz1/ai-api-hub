<template>
  <main class="assets-page">
    <header class="assets-toolbar">
      <div class="assets-heading">
        <h1>{{ t("assets.title") }}</h1>
        <p>{{ t("assets.description") }}</p>
      </div>

      <div class="assets-actions">
        <div class="assets-tabs" role="tablist" :aria-label="t('assets.filterLabel')">
          <button v-for="option in filterOptions" :key="option.value" type="button" :class="{ active: filter === option.value }" @click="filter = option.value">
            {{ option.label }}
          </button>
        </div>
        <button class="refresh-button" type="button" :disabled="loading" @click="loadAssets">
          {{ loading ? t("assets.loading") : t("assets.refresh") }}
        </button>
      </div>
    </header>

    <section v-if="error" class="asset-state is-error">
      {{ error }}
    </section>

    <section v-else-if="loading" class="asset-grid">
      <div v-for="index in 8" :key="index" class="asset-skeleton"></div>
    </section>

    <section v-else-if="filteredAssets.length" class="asset-grid">
      <article v-for="asset in filteredAssets" :key="`${asset.kind}-${asset.id}`" class="asset-card">
        <button class="asset-preview" type="button" @click="previewAsset(asset)">
          <img v-if="asset.kind === 'image'" :src="asset.src" :alt="asset.prompt || asset.id" loading="lazy" />
          <video v-else :src="asset.src" muted playsinline preload="metadata"></video>
          <span class="asset-kind">{{ assetKindLabels[asset.kind] }}</span>
        </button>
        <div class="asset-meta">
          <p>{{ asset.prompt || t("assets.untitledAsset") }}</p>
          <span>{{ asset.id }}</span>
        </div>
        <div class="asset-card-actions">
          <button type="button" @click="copyAssetSource(asset)">{{ t("assets.copySource") }}</button>
          <button class="danger" type="button" :disabled="deletingId === `${asset.kind}-${asset.id}`" @click="deleteAsset(asset)">
            {{ deletingId === `${asset.kind}-${asset.id}` ? t("assets.deleting") : t("assets.delete") }}
          </button>
        </div>
      </article>
    </section>

    <section v-else class="asset-state">
      {{ t("assets.emptyState") }}
    </section>

    <dialog ref="previewDialogRef" class="modal asset-preview-dialog" @click="onPreviewDialogClick" @cancel.prevent="closePreview">
      <div class="modal-box asset-preview-box" @click.stop>
        <button class="preview-close" type="button" :aria-label="t('assets.closePreview')" @click="closePreview">x</button>
        <img v-if="previewItem?.kind === 'image'" :src="previewItem.src" :alt="previewItem.prompt || previewItem.id" />
        <video v-else-if="previewItem" :src="previewItem.src" controls autoplay></video>
        <p>{{ previewItem?.prompt }}</p>
      </div>
    </dialog>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { deleteGeneratedAsset, getGeneratedAssets, type GeneratedAssetItem, type GeneratedAssetKind } from "@/services/creation/asset";
import { dsAlert } from "@/utils";

type AssetFilter = "all" | GeneratedAssetKind;

const { t } = useI18n();
const assets = ref<GeneratedAssetItem[]>([]);
const filter = ref<AssetFilter>("all");
const loading = ref(false);
const error = ref("");
const deletingId = ref("");
const previewItem = ref<GeneratedAssetItem | null>(null);
const previewDialogRef = ref<HTMLDialogElement | null>(null);

const filterOptions = computed<Array<{ label: string; value: AssetFilter }>>(() => [
  { label: t("assets.filters.all"), value: "all" },
  { label: t("assets.filters.images"), value: "image" },
  { label: t("assets.filters.videos"), value: "video" },
]);
const assetKindLabels = computed<Record<GeneratedAssetKind, string>>(() => ({
  image: t("assets.assetKinds.image"),
  video: t("assets.assetKinds.video"),
}));

const filteredAssets = computed(() => (filter.value === "all" ? assets.value : assets.value.filter((item) => item.kind === filter.value)));

async function loadAssets() {
  loading.value = true;
  error.value = "";
  try {
    assets.value = await getGeneratedAssets();
  } catch (err) {
    assets.value = [];
    error.value = err instanceof Error ? err.message : t("assets.loadFailed");
  } finally {
    loading.value = false;
  }
}

async function copyAssetSource(asset: GeneratedAssetItem) {
  try {
    await navigator.clipboard.writeText(asset.src);
    dsAlert({ type: "success", message: t("assets.copySuccess") });
  } catch (err) {
    dsAlert({ type: "error", message: t("assets.copyFailed", { error: err instanceof Error ? err.message : String(err) }) });
  }
}

async function deleteAsset(asset: GeneratedAssetItem) {
  const confirmed = window.confirm(t("assets.confirmDelete", { kind: assetKindLabels.value[asset.kind] }));
  if (!confirmed) return;

  deletingId.value = `${asset.kind}-${asset.id}`;
  try {
    await deleteGeneratedAsset(asset);
    assets.value = assets.value.filter((item) => !(item.kind === asset.kind && item.id === asset.id));
    dsAlert({ type: "success", message: t("assets.deleteSuccess") });
  } catch (err) {
    dsAlert({ type: "error", message: err instanceof Error ? err.message : t("assets.deleteFailed") });
  } finally {
    deletingId.value = "";
  }
}

function previewAsset(asset: GeneratedAssetItem) {
  previewItem.value = asset;
  previewDialogRef.value?.showModal();
}

function closePreview() {
  previewDialogRef.value?.close();
  previewItem.value = null;
}

function onPreviewDialogClick(event: MouseEvent) {
  if (event.target === previewDialogRef.value) closePreview();
}

onMounted(loadAssets);
</script>

<style lang="scss" scoped>
.assets-page {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  padding: 34px clamp(18px, 4vw, 48px);
  box-sizing: border-box;
  color: oklch(var(--bc));
  background: linear-gradient(180deg, oklch(var(--b2) / 0.55), transparent 260px), oklch(var(--b1));
}

.assets-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.assets-heading {
  min-width: 0;

  h1 {
    margin: 0;
    font-size: clamp(28px, 4vw, 44px);
    line-height: 1;
    font-weight: 760;
  }

  p {
    margin: 10px 0 0;
    color: oklch(var(--bc) / 0.58);
    font-size: 14px;
  }
}

.assets-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.assets-tabs {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  border-radius: 8px;
  background: oklch(var(--bc) / 0.06);

  button {
    height: 32px;
    padding: 0 12px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: oklch(var(--bc) / 0.68);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;

    &.active {
      background: oklch(var(--b1));
      color: oklch(var(--bc));
      box-shadow: 0 1px 5px oklch(var(--bc) / 0.08);
    }
  }
}

.refresh-button {
  height: 40px;
  padding: 0 16px;
  border: 0;
  border-radius: 8px;
  background: oklch(var(--bc));
  color: oklch(var(--b1));
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;

  &:disabled {
    opacity: 0.58;
    cursor: wait;
  }
}

.asset-grid {
  display: grid;
  margin-top: 28px;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 14px;
}

.asset-card,
.asset-skeleton {
  border: 1px solid oklch(var(--bc) / 0.08);
  border-radius: 8px;
  background: oklch(var(--b1));
  overflow: hidden;
  box-shadow: 0 10px 28px oklch(var(--bc) / 0.06);
}

.asset-skeleton {
  aspect-ratio: 1 / 1.18;
  background: linear-gradient(90deg, oklch(var(--b2)), oklch(var(--b3) / 0.7), oklch(var(--b2)));
  background-size: 180% 100%;
  animation: assetSkeleton 1.1s linear infinite;
}

.asset-preview {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 1 / 0.74;
  padding: 0;
  border: 0;
  background: oklch(var(--b2));
  overflow: hidden;
  cursor: zoom-in;

  img,
  video {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }
}

.asset-kind {
  position: absolute;
  left: 10px;
  top: 10px;
  padding: 4px 8px;
  border-radius: 999px;
  background: oklch(var(--b1) / 0.9);
  color: oklch(var(--bc));
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
}

.asset-meta {
  padding: 12px 12px 10px;

  p {
    height: 40px;
    margin: 0;
    overflow: hidden;
    color: oklch(var(--bc));
    font-size: 13px;
    line-height: 1.5;
  }

  span {
    display: block;
    margin-top: 8px;
    color: oklch(var(--bc) / 0.46);
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.asset-card-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 0 12px 12px;

  button {
    height: 32px;
    border: 0;
    border-radius: 7px;
    background: oklch(var(--b2));
    color: oklch(var(--bc));
    font-size: 12px;
    font-weight: 760;
    cursor: pointer;

    &.danger {
      background: oklch(var(--er) / 0.12);
      color: oklch(var(--er));
    }

    &:disabled {
      opacity: 0.56;
      cursor: wait;
    }
  }
}

.asset-state {
  min-height: 180px;
  display: grid;
  place-items: center;
  border: 1px dashed oklch(var(--bc) / 0.16);
  border-radius: 8px;
  color: oklch(var(--bc) / 0.58);
  background: oklch(var(--b1) / 0.62);

  &.is-error {
    color: oklch(var(--er));
    border-color: oklch(var(--er) / 0.24);
    background: oklch(var(--er) / 0.08);
  }
}

.asset-preview-dialog {
  &::backdrop {
    background: oklch(var(--bc) / 0.42);
  }
}

.asset-preview-box {
  position: relative;
  width: min(920px, calc(100vw - 32px));
  max-width: none;
  border-radius: 8px;
  background: oklch(var(--b1));

  img,
  video {
    display: block;
    width: 100%;
    max-height: 70vh;
    object-fit: contain;
    background: #111;
    border-radius: 6px;
  }

  p {
    margin: 12px 40px 0 0;
    color: oklch(var(--bc) / 0.72);
    line-height: 1.5;
  }
}

.preview-close {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 1;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 999px;
  background: oklch(var(--b1) / 0.9);
  color: oklch(var(--bc));
  cursor: pointer;
}

@keyframes assetSkeleton {
  to {
    background-position: -180% 0;
  }
}

@media (max-width: 720px) {
  .assets-page {
    padding-top: 72px;
  }

  .assets-toolbar {
    flex-direction: column;
  }

  .assets-actions,
  .assets-tabs,
  .refresh-button {
    width: 100%;
  }

  .assets-tabs button,
  .refresh-button {
    flex: 1;
  }

  .asset-summary {
    grid-template-columns: 1fr;
  }
}
</style>
