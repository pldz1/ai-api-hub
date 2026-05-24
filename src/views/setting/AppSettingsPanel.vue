<template>
  <div class="settings-section">
    <div class="section-header">
      <div>
        <h2>{{ t("user.app.title") }}</h2>
        <p>{{ t("user.app.description") }}</p>
      </div>
    </div>

    <div class="app-settings-grid">
      <section class="app-settings-card">
        <h3>{{ t("user.app.importExport") }}</h3>
        <p>{{ t("user.app.importExportDescription") }}</p>
        <div class="app-settings-actions">
          <button class="btn btn-outline" @click="emit('export-settings')">{{ t("user.app.export") }}</button>
          <button class="btn btn-outline" @click="emit('import-settings')">{{ t("user.app.import") }}</button>
        </div>
      </section>

      <section class="app-settings-card">
        <h3>{{ t("user.app.resources") }}</h3>
        <p>{{ t("user.app.resourcesDescription") }}</p>
        <div class="app-settings-actions">
          <a class="btn btn-outline" href="https://github.com/pldz1/ai-api-hub/releases" target="_blank" rel="noopener noreferrer">
            {{ t("user.app.releases") }}
          </a>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";

const emit = defineEmits<{
  "import-settings": [];
  "export-settings": [];
}>();

const { t } = useI18n();
</script>

<style lang="scss" scoped>
.app-settings-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.app-settings-card {
  border: 1px solid rgba(17, 24, 39, 0.07);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.82);
  padding: 24px;
  box-shadow: 0 10px 28px rgba(31, 41, 55, 0.04);

  h3 {
    font-size: 18px;
    font-weight: 600;
    color: #202124;
  }

  p {
    margin-top: 8px;
    font-size: 13px;
    line-height: 1.6;
    color: #5f6368;
  }
}

.app-settings-actions {
  margin-top: 18px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

@media (max-width: 1100px) {
  .app-settings-grid {
    grid-template-columns: 1fr;
  }
}
</style>
