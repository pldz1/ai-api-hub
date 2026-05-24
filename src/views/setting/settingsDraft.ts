import { computed, onBeforeUnmount, ref, watch } from "vue";
import type { ModelSettings } from "@/types/settings";

export type SettingsAutosaveState = "saved" | "dirty" | "saving" | "error";

export interface SettingsDraftPayload {
  models: ModelSettings;
  templates: unknown[];
}

interface UseSettingsDraftOptions {
  autosaveDelay?: number;
  getInitialDraft: () => SettingsDraftPayload;
  persistDraft: (draft: SettingsDraftPayload) => Promise<boolean>;
}

function createEmptyModelSettings(): ModelSettings {
  return { chat: [], imageGeneration: [], imageEdit: [], image: [] };
}

function cloneDraftData<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

function normalizeDraftPayload(payload: Partial<SettingsDraftPayload> | null | undefined = {}): SettingsDraftPayload {
  return {
    models: {
      ...createEmptyModelSettings(),
      ...cloneDraftData(payload?.models || createEmptyModelSettings()),
    },
    templates: cloneDraftData(payload?.templates || []),
  };
}

function serializeDraftPayload(payload: SettingsDraftPayload): string {
  return JSON.stringify({
    models: payload.models,
    templates: payload.templates,
  });
}

export function useSettingsDraft(options: UseSettingsDraftOptions) {
  const autosaveDelay = options.autosaveDelay ?? 500;
  const draftModels = ref<ModelSettings>(createEmptyModelSettings());
  const draftTemplates = ref<unknown[]>([]);
  const autosaveState = ref<SettingsAutosaveState>("saved");
  const lastSavedSnapshot = ref("");
  let autosaveTimer: number | null = null;
  let isHydrating = false;
  let isPersisting = false;

  function getDraftPayload(): SettingsDraftPayload {
    return {
      models: cloneDraftData(draftModels.value),
      templates: cloneDraftData(draftTemplates.value),
    };
  }

  function getDraftSnapshot(): string {
    return serializeDraftPayload(getDraftPayload());
  }

  const hasUnsavedChanges = computed(() => getDraftSnapshot() !== lastSavedSnapshot.value);
  const shouldBlockUnload = computed(() => autosaveState.value === "saving" || hasUnsavedChanges.value);

  function syncDraftFromSource(payload: Partial<SettingsDraftPayload> | null | undefined = options.getInitialDraft()) {
    isHydrating = true;
    const normalizedPayload = normalizeDraftPayload(payload);
    draftModels.value = normalizedPayload.models;
    draftTemplates.value = normalizedPayload.templates;
    lastSavedSnapshot.value = serializeDraftPayload(normalizedPayload);
    autosaveState.value = "saved";
    isHydrating = false;
  }

  async function persistCurrentDraft(): Promise<boolean> {
    if (isHydrating || isPersisting) return false;
    if (!hasUnsavedChanges.value) {
      autosaveState.value = "saved";
      return true;
    }

    const nextDraft = getDraftPayload();
    isPersisting = true;
    autosaveState.value = "saving";

    try {
      const persisted = await options.persistDraft(nextDraft);
      if (!persisted) {
        autosaveState.value = "error";
        return false;
      }

      lastSavedSnapshot.value = serializeDraftPayload(nextDraft);
      autosaveState.value = "saved";
      return true;
    } finally {
      isPersisting = false;
    }
  }

  function scheduleAutosave() {
    if (isHydrating || isPersisting) return;
    if (!hasUnsavedChanges.value) {
      autosaveState.value = "saved";
      return;
    }

    autosaveState.value = "dirty";
    if (autosaveTimer) window.clearTimeout(autosaveTimer);
    autosaveTimer = window.setTimeout(() => {
      persistCurrentDraft();
    }, autosaveDelay);
  }

  watch(
    [draftModels, draftTemplates],
    () => {
      scheduleAutosave();
    },
    { deep: true },
  );

  onBeforeUnmount(() => {
    if (autosaveTimer) window.clearTimeout(autosaveTimer);
  });

  syncDraftFromSource();

  return {
    autosaveState,
    draftModels,
    draftTemplates,
    hasUnsavedChanges,
    shouldBlockUnload,
    getDraftPayload,
    syncDraftFromSource,
  };
}
