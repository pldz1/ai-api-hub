<template>
  <div class="settings-section">
    <div class="section-header">
      <div>
        <h2>{{ t("user.templates.title") }}</h2>
        <p>{{ t("user.templates.description") }}</p>
      </div>
      <div class="section-actions">
        <button class="btn btn-neutral" @click="addTemplate">
          {{ t("user.templates.add") }}
        </button>
      </div>
    </div>

    <div class="settings-workspace">
      <aside class="settings-list-panel">
        <button
          v-for="(template, index) in props.templates"
          :key="template.id"
          class="settings-list-item"
          :class="{ active: index === selectedIndex }"
          @click="selectIndex(index)"
        >
          <div class="settings-list-title">{{ template.name || t("common.unnamedTemplate") }}</div>
          <div class="settings-list-meta">
            {{ summarizeTemplate(template.value) }}
          </div>
        </button>
        <div v-if="props.templates.length === 0" class="settings-empty-list">
          {{ t("user.templates.emptyList") }}
        </div>
      </aside>

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
            <div class="template-form-field">
              <label>{{ t("user.templates.name") }}</label>
              <input type="text" class="input input-bordered w-full" :value="currentTemplate.name" @input="updateField('name', $event.target.value)" />
            </div>

            <div class="template-form-field">
              <label>{{ t("user.templates.instruction") }}</label>
              <textarea
                class="textarea textarea-bordered template-textarea"
                :value="currentTemplate.value"
                @input="updateField('value', $event.target.value)"
              ></textarea>
            </div>
          </div>
        </template>

        <div v-else class="settings-empty-detail">
          {{ t("user.templates.emptyDetail") }}
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { append4Random, getUuid } from "@/utils";

const props = defineProps({
  templates: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits(["update:templates"]);
const { t } = useI18n();
const selectedIndex = ref(-1);

const currentTemplate = computed(() => {
  if (selectedIndex.value < 0 || selectedIndex.value >= props.templates.length) return null;
  return props.templates[selectedIndex.value];
});

const selectIndex = (index) => {
  selectedIndex.value = index;
};

const updateTemplates = (nextTemplates) => {
  emit("update:templates", nextTemplates);
};

const updateField = (field, value) => {
  if (selectedIndex.value < 0) return;
  const nextTemplates = props.templates.map((item, index) => {
    if (index !== selectedIndex.value) return item;
    return {
      ...item,
      [field]: value,
    };
  });
  updateTemplates(nextTemplates);
};

const addTemplate = () => {
  const nextTemplate = {
    id: getUuid("inst"),
    name: append4Random(t("user.templates.defaultName")),
    value: "",
  };
  const nextTemplates = [...props.templates, nextTemplate];
  updateTemplates(nextTemplates);
  selectedIndex.value = nextTemplates.length - 1;
};

const duplicateTemplate = () => {
  if (!currentTemplate.value) return;
  const duplicated = {
    ...structuredClone(currentTemplate.value),
    id: getUuid("inst"),
    name: `${currentTemplate.value.name || t("user.templates.defaultName")}-${t("common.duplicateSuffix")}`,
  };
  const nextTemplates = [...props.templates, duplicated];
  updateTemplates(nextTemplates);
  selectedIndex.value = nextTemplates.length - 1;
};

const deleteTemplate = () => {
  if (selectedIndex.value < 0) return;
  const nextTemplates = props.templates.filter((_, index) => index !== selectedIndex.value);
  updateTemplates(nextTemplates);
  if (nextTemplates.length === 0) {
    selectedIndex.value = -1;
  } else if (selectedIndex.value >= nextTemplates.length) {
    selectedIndex.value = nextTemplates.length - 1;
  }
};

const summarizeTemplate = (value) => {
  if (!value) return t("user.templates.emptyContent");
  return value.length > 64 ? `${value.slice(0, 64)}...` : value;
};

watch(
  () => props.templates.length,
  (newLength) => {
    if (newLength === 0) {
      selectedIndex.value = -1;
      return;
    }

    if (selectedIndex.value === -1) {
      selectedIndex.value = 0;
      return;
    }

    if (selectedIndex.value >= newLength) {
      selectedIndex.value = newLength - 1;
    }
  },
  { immediate: true },
);
</script>

<style lang="scss" scoped>
.detail-toolbar-actions {
  display: flex;
  gap: 10px;
}

.template-form-card {
  border: 1px solid oklch(var(--b3) / 0.6);
  border-radius: 20px;
  background: linear-gradient(180deg, oklch(var(--b1)) 0%, oklch(var(--b2) / 0.65) 100%);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  box-shadow: 0 10px 30px oklch(var(--n) / 0.04);
}

.template-form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;

  label {
    font-size: 12px;
    font-weight: 600;
  }
}

.template-textarea {
  min-height: 280px;
  resize: vertical;
}
</style>
