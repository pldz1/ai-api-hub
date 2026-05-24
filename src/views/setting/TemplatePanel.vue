<template>
  <div class="settings-section">
    <!-- Template panel header and primary creation action -->
    <div class="section-header">
      <div>
        <h2>{{ t("user.templates.title") }}</h2>
        <p>{{ t("user.templates.description") }}</p>
      </div>
      <button class="btn btn-neutral" @click="addTemplate">{{ t("user.templates.add") }}</button>
    </div>

    <div class="settings-workspace">
      <!-- Saved instruction templates list -->
      <aside class="settings-list-panel">
        <button
          v-for="(template, index) in templates"
          :key="template.id"
          class="settings-list-item"
          :class="{ active: index === selectedIndex }"
          @click="selectedIndex = index"
        >
          <div class="settings-list-title">{{ template.name || t("common.unnamedTemplate") }}</div>
          <div class="settings-list-meta">{{ summarizeTemplate(template.value) }}</div>
        </button>
        <div v-if="templates.length === 0" class="settings-empty-list">{{ t("user.templates.emptyList") }}</div>
      </aside>

      <!-- Selected template editor -->
      <section class="settings-detail-panel">
        <template v-if="currentTemplate">
          <div class="detail-toolbar">
            <div>
              <h3>{{ currentTemplate.name || t("common.unnamedTemplate") }}</h3>
              <p>{{ t("user.templates.detailHint") }}</p>
            </div>
            <div class="detail-toolbar-actions">
              <button class="btn btn-outline" @click="duplicateTemplate">{{ t("user.templates.duplicate") }}</button>
              <button class="btn btn-outline btn-error" @click="deleteTemplate">{{ t("user.templates.delete") }}</button>
            </div>
          </div>

          <div class="template-form-card">
            <!-- Template metadata and prompt body -->
            <label>
              <span>{{ t("user.templates.name") }}</span>
              <input type="text" class="input input-bordered w-full" :value="currentTemplate.name" @input="updateField('name', $event)" />
            </label>
            <label>
              <span>{{ t("user.templates.instruction") }}</span>
              <textarea class="textarea textarea-bordered template-textarea" :value="currentTemplate.value" @input="updateField('value', $event)" />
            </label>
          </div>
        </template>

        <div v-else class="settings-empty-detail">{{ t("user.templates.emptyDetail") }}</div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { append4Random, getUuid } from "@/utils";

type ChatInstructionTemplate = { id: string; name: string; value: string };

const props = withDefaults(defineProps<{ templates?: ChatInstructionTemplate[] }>(), {
  templates: () => [],
});
const emit = defineEmits<{ "update:templates": [templates: ChatInstructionTemplate[]] }>();
const { t } = useI18n();
const selectedIndex = ref(-1);

// Keep the selected index guarded because templates can be removed by autosave/import updates.
const currentTemplate = computed(() => {
  if (selectedIndex.value < 0 || selectedIndex.value >= props.templates.length) return null;
  return props.templates[selectedIndex.value];
});

function updateTemplates(nextTemplates: ChatInstructionTemplate[]) {
  emit("update:templates", nextTemplates);
}

function addTemplate() {
  const nextTemplate = {
    id: getUuid("inst"),
    name: append4Random(t("user.templates.defaultName")),
    value: "",
  };
  const nextTemplates = [...props.templates, nextTemplate];
  updateTemplates(nextTemplates);
  selectedIndex.value = nextTemplates.length - 1;
}

function duplicateTemplate() {
  if (!currentTemplate.value) return;
  // Clone the active template so edits never mutate the original item by reference.
  const duplicated = {
    ...structuredClone(currentTemplate.value),
    id: getUuid("inst"),
    name: `${currentTemplate.value.name || t("user.templates.defaultName")}-${t("common.duplicateSuffix")}`,
  };
  const nextTemplates = [...props.templates, duplicated];
  updateTemplates(nextTemplates);
  selectedIndex.value = nextTemplates.length - 1;
}

function deleteTemplate() {
  if (selectedIndex.value < 0) return;
  const nextTemplates = props.templates.filter((_, index) => index !== selectedIndex.value);
  updateTemplates(nextTemplates);
  selectedIndex.value = Math.min(selectedIndex.value, nextTemplates.length - 1);
}

function updateField(field: "name" | "value", event: Event) {
  const target = event.target;
  if (selectedIndex.value < 0 || !(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
  updateTemplates(props.templates.map((item, index) => (index === selectedIndex.value ? { ...item, [field]: target.value } : item)));
}

// Keep a compact preview for the list without changing the full template content.
function summarizeTemplate(value: string) {
  if (!value) return t("user.templates.emptyContent");
  return value.length > 64 ? `${value.slice(0, 64)}...` : value;
}

watch(
  () => props.templates.length,
  (length) => {
    // Re-anchor selection after add/delete/import operations.
    selectedIndex.value = length === 0 ? -1 : Math.min(Math.max(selectedIndex.value, 0), length - 1);
  },
  { immediate: true },
);
</script>

<style lang="scss" scoped>
.detail-toolbar-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.template-form-card {
  border: 1px solid rgba(17, 24, 39, 0.07);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.82);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  box-shadow: 0 10px 28px rgba(31, 41, 55, 0.04);

  label {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  span {
    font-size: 12px;
    font-weight: 600;
    color: #374151;
  }
}

.template-textarea {
  min-height: 280px;
  resize: vertical;
}
</style>
