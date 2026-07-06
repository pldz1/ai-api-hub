<template>
  <div class="settings-section">
    <div class="settings-workspace template-settings-workspace">
      <!-- Saved instruction templates list -->
      <aside class="settings-list-panel template-list-panel" :class="{ empty: templates.length === 0 }">
        <div class="template-list-rail">
          <button
            v-for="(template, index) in templates"
            :key="template.id"
            class="settings-list-item"
            :class="{ active: index === selectedIndex }"
            @click="selectedIndex = index"
          >
            <div class="settings-list-title">{{ template.name || t("common.unnamedTemplate") }}</div>
            <div class="settings-list-meta">
              <span>{{ summarizeTemplate(template.value) }}</span>
            </div>
          </button>
        </div>
        <div v-if="templates.length === 0" class="settings-empty-list">{{ t("user.templates.emptyList") }}</div>
      </aside>

      <!-- Selected template editor -->
      <section class="settings-detail-content">
        <div class="template-list-actions">
          <button class="template-list-action is-primary" type="button" @click="addTemplate">
            <SvgIcon class="template-list-action-icon" :src="newIcon" />
            <span>{{ t("user.templates.add") }}</span>
          </button>
          <button class="template-list-action" type="button" :disabled="!currentTemplate" @click="duplicateTemplate">
            <SvgIcon class="template-list-action-icon" :src="copyIcon" />
            <span>{{ t("user.templates.duplicate") }}</span>
          </button>
          <button class="template-list-action is-danger" type="button" :disabled="!currentTemplate" @click="deleteTemplate">
            <SvgIcon class="template-list-action-icon" :src="deleteIcon" />
            <span>{{ t("user.templates.delete") }}</span>
          </button>
        </div>

        <template v-if="currentTemplate">
          <div class="template-editor">
            <!-- Template metadata and prompt body -->
            <label>
              <span>{{ t("user.templates.name") }}</span>
              <input type="text" class="input input-bordered template-input" :value="currentTemplate.name" @input="updateField('name', $event)" />
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
import copyIcon from "@/assets/svg/copy16.svg";
import deleteIcon from "@/assets/svg/delete16.svg";
import newIcon from "@/assets/svg/new24.svg";
import SvgIcon from "@/components/SvgIcon.vue";
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
.settings-workspace.template-settings-workspace {
  width: min(100%, 1064px);
  margin-inline: auto;
  display: grid;
  grid-template-columns: minmax(220px, 260px) minmax(0, 1fr);
  gap: 22px;
  min-height: 0;
  flex: 1 1 auto;
  overflow: hidden;
}

.settings-list-panel.template-list-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  padding: 10px;
  overflow: hidden;
  border-radius: 14px;
  background: oklch(var(--b1));
  box-shadow: none;

  &.empty {
    overflow: hidden;
  }
}

.template-list-rail {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 8px;
  overflow-y: auto;
  overscroll-behavior-y: contain;
  scrollbar-gutter: stable;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-thumb {
    border: 2px solid transparent;
    border-radius: 8px;
    background: oklch(var(--bc) / 0.18);
    background-clip: content-box;
  }

  &::-webkit-scrollbar-track {
    margin-block: 6px;
    background: transparent;
  }
}

.settings-list-panel.template-list-panel .settings-list-item {
  width: 100%;
  flex: 0 0 auto;
  min-height: 76px;
  padding: 12px 13px;
  border-radius: 10px;
  box-shadow: none;
  transition: none;

  &:hover {
    border-color: oklch(var(--bc) / 0.12);
    box-shadow: none;
  }

  &.active {
    border-color: oklch(var(--p) / 0.28);
    background: oklch(var(--p) / 0.1);
    box-shadow: none;
  }
}

.template-list-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(112px, max-content));
  gap: 6px;
  flex: 0 0 auto;
  justify-content: flex-end;
}

.template-list-action {
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
  cursor: pointer;

  span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &:hover:not(:disabled) {
    border-color: oklch(var(--bc) / 0.18);
    background: oklch(var(--b2) / 0.5);
    color: oklch(var(--bc));
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  &.is-primary {
    border-color: oklch(var(--p) / 0.28);
    background: oklch(var(--p) / 0.1);
    color: oklch(var(--p));

    &:hover {
      border-color: oklch(var(--p) / 0.42);
      background: oklch(var(--p) / 0.14);
    }
  }

  &.is-danger {
    color: oklch(var(--er));

    &:hover:not(:disabled) {
      border-color: oklch(var(--er) / 0.28);
      background: oklch(var(--er) / 0.1);
    }
  }
}

.template-list-action-icon {
  width: 15px;
  height: 15px;
  flex: 0 0 auto;
}

.template-editor {
  min-height: 0;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 18px;

  label {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  span {
    font-size: 12px;
    font-weight: 600;
    color: oklch(var(--bc) / 0.82);
  }
}

.template-textarea {
  width: 100%;
  min-height: 280px;
  flex: 1 1 auto;
  resize: vertical;
}

.template-input {
  width: 100%;
}

@media (max-width: 900px) {
  .settings-workspace.template-settings-workspace {
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: 16px;
    flex: 0 0 auto;
    overflow: visible;
  }

  .settings-list-panel.template-list-panel {
    border-radius: 14px;
    max-height: min(42vh, 286px);
    padding: 8px;
    overflow: hidden;
  }

  .template-list-rail {
    padding-right: 8px;
    overflow-y: auto;
  }

  .settings-list-panel.template-list-panel .settings-list-item {
    width: 100%;
    flex: 0 0 auto;
    min-height: 76px;
  }
}

@media (max-width: 480px) {
  .template-list-actions {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .template-list-action {
    padding-inline: 6px;
    font-size: 11px;
  }

  .template-editor {
    gap: 18px;
  }

  .template-textarea {
    min-height: 220px;
  }
}
</style>
