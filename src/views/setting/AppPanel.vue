<template>
  <div class="settings-section">
    <div class="app-settings-workspace">
      <!-- Settings backup and restore actions -->
      <section class="app-settings-row">
        <div class="app-settings-copy">
          <h3>{{ t("user.app.importExport") }}</h3>
          <p>{{ t("user.app.importExportDescription") }}</p>
        </div>
        <div class="app-settings-actions two-actions">
          <button class="app-settings-action" type="button" @click="emit('export-settings')">
            <SvgIcon class="app-settings-action-icon" :src="saveIcon" />
            <span>{{ t("user.app.export") }}</span>
          </button>
          <button class="app-settings-action" type="button" @click="emit('import-settings')">
            <SvgIcon class="app-settings-action-icon" :src="attachIcon" />
            <span>{{ t("user.app.import") }}</span>
          </button>
        </div>
      </section>

      <!-- Project resources -->
      <section class="app-settings-row">
        <div class="app-settings-copy">
          <h3>{{ t("user.app.resources") }}</h3>
          <p>{{ t("user.app.resourcesDescription") }}</p>
        </div>
        <div class="app-settings-actions">
          <a class="app-settings-action" href="https://github.com/pldz1/ai-api-hub/releases" target="_blank" rel="noopener noreferrer">
            <SvgIcon class="app-settings-action-icon" :src="webIcon" />
            <span>{{ t("user.app.releases") }}</span>
          </a>
        </div>
      </section>

      <section class="app-settings-row">
        <div class="app-settings-copy">
          <h3>{{ t("user.app.about") }}</h3>
          <p>{{ APP_NAME }} · {{ APP_VERSION }} · {{ UPDATE_TIME }}</p>
        </div>
        <div class="app-settings-actions">
          <a class="app-settings-action" :href="REPO_SOURCE_LINK" target="_blank" rel="noopener noreferrer">
            <SvgIcon class="app-settings-action-icon" :src="webIcon" />
            <span>{{ t("user.app.source") }}</span>
          </a>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import attachIcon from "@/assets/svg/attach24.svg";
import saveIcon from "@/assets/svg/save18.svg";
import webIcon from "@/assets/svg/web24.svg";
import SvgIcon from "@/components/SvgIcon.vue";
import { APP_NAME, APP_VERSION, REPO_SOURCE_LINK, UPDATE_TIME } from "@/constants";

// Parent view owns import/export workflows; this panel only exposes the actions.
const emit = defineEmits<{
  "import-settings": [];
  "export-settings": [];
}>();

const { t } = useI18n();
</script>

<style lang="scss" scoped>
.app-settings-workspace {
  width: min(100%, 1064px);
  margin-inline: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  flex: 1 1 auto;
  overflow: hidden;
}

.app-settings-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  gap: 18px;
  align-items: center;
  min-height: 76px;
  padding: 12px 13px;
  border: 1px solid oklch(var(--bc) / 0.06);
  border-radius: 10px;
  background: oklch(var(--b1));
}

.app-settings-copy {
  min-width: 0;

  h3 {
    font-size: 14px;
    line-height: 1.35;
    font-weight: 700;
    color: oklch(var(--bc));
  }

  p {
    margin-top: 6px;
    font-size: 12px;
    line-height: 1.5;
    color: oklch(var(--bc) / 0.68);
  }
}

.app-settings-actions {
  display: grid;
  grid-template-columns: minmax(112px, max-content);
  gap: 6px;
  justify-content: flex-end;

  &.two-actions {
    grid-template-columns: repeat(2, minmax(112px, max-content));
  }
}

.app-settings-action {
  min-width: 0;
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 8px;
  border: 1px solid oklch(var(--bc) / 0.1);
  border-radius: 8px;
  background: oklch(var(--b1));
  color: oklch(var(--bc) / 0.76);
  font-size: 12px;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;

  span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &:hover {
    border-color: oklch(var(--bc) / 0.18);
    background: oklch(var(--b2) / 0.5);
    color: oklch(var(--bc));
  }
}

.app-settings-action-icon {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
}

@media (max-width: 720px) {
  .app-settings-workspace {
    width: 100%;
    flex: 0 0 auto;
    overflow: visible;
  }

  .app-settings-row {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .app-settings-actions,
  .app-settings-actions.two-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    justify-content: stretch;
  }

  .app-settings-actions:not(.two-actions) {
    grid-template-columns: 1fr;
  }
}
</style>
