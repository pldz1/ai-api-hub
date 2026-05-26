import store from "@/store";
import { tr } from "@/i18n";
import { buildPersistedModelSettingsPayload, sanitizeModelSettings } from "@/models";
import { dsAlert, getChatTemplateListValidationError, getModelSettingValidationError } from "@/utils";
import { apiRequest } from "./storage";
import type { ApiResponse } from "@/services/types";
import type { ModelSettings } from "@/types";

type ChatInstructionTemplate = {
  id: string;
  name: string;
  value: string;
};

const emptyModelSettings = (): ModelSettings => ({
  chat: [],
  image: [],
});

const getModelsAPI = (): Promise<ApiResponse<string>> => apiRequest("post", "/_api/workspace/getModels", {});
const setModelsAPI = (data: string): Promise<ApiResponse<null>> => apiRequest("post", "/_api/workspace/setModels", { data });
const getChatInsTemplateListAPI = (): Promise<ApiResponse<string>> => apiRequest("post", "/_api/workspace/getChatInsTemplateList", {});
const setChatInsTemplateListAPI = (data: string): Promise<ApiResponse<null>> => apiRequest("post", "/_api/workspace/setChatInsTemplateList", { data });

function parseStoredJson<T>(raw: string, fallback: T): T {
  if (!raw) return fallback;
  return JSON.parse(raw) as T;
}

export async function getModels(): Promise<boolean> {
  const res = await getModelsAPI();
  if (!res.flag) {
    await store.dispatch("setModels", emptyModelSettings());
    dsAlert({ type: "error", message: tr("toast.userModelsFetchFailed", { error: res.log }) });
    return false;
  }

  try {
    const parsed = parseStoredJson<unknown>(res.data, emptyModelSettings());
    const validationError = getModelSettingValidationError(parsed);
    if (validationError) {
      await store.dispatch("setModels", emptyModelSettings());
      dsAlert({ type: "error", message: tr("toast.userModelsInvalid", { error: validationError }) });
      return false;
    }

    await store.dispatch("setModels", sanitizeModelSettings(parsed as ModelSettings));
    return true;
  } catch (error) {
    await store.dispatch("setModels", emptyModelSettings());
    dsAlert({ type: "error", message: tr("toast.userModelsInvalid", { error: error instanceof Error ? error.message : String(error) }) });
    return false;
  }
}

export async function setModels(models: ModelSettings = store.state.models): Promise<boolean> {
  const payload = buildPersistedModelSettingsPayload(models);
  const res = await setModelsAPI(JSON.stringify(payload));
  if (!res.flag) {
    dsAlert({ type: "error", message: tr("toast.userModelsSaveFailed", { error: res.log }) });
    return false;
  }

  return true;
}

export async function getChatInsTemplateList(): Promise<boolean> {
  const res = await getChatInsTemplateListAPI();
  if (!res.flag) {
    await store.dispatch("setChatInsTemplateList", []);
    dsAlert({ type: "error", message: tr("toast.userTemplatesFetchFailed", { error: res.log }) });
    return false;
  }

  try {
    const templates = parseStoredJson<ChatInstructionTemplate[]>(res.data, []);
    const validationError = getChatTemplateListValidationError(templates);
    if (validationError) {
      await store.dispatch("setChatInsTemplateList", []);
      dsAlert({ type: "error", message: tr("toast.userTemplatesFetchFailed", { error: validationError }) });
      return false;
    }

    await store.dispatch("setChatInsTemplateList", templates);
    return true;
  } catch (error) {
    await store.dispatch("setChatInsTemplateList", []);
    dsAlert({ type: "error", message: tr("toast.userTemplatesFetchFailed", { error: error instanceof Error ? error.message : String(error) }) });
    return false;
  }
}

export async function setChatInsTemplateList(templates: unknown[] = store.state.chatInsTemplateList): Promise<boolean> {
  const validationError = getChatTemplateListValidationError(templates);
  if (validationError) {
    dsAlert({ type: "error", message: tr("toast.userTemplatesSaveFailed", { error: validationError }) });
    return false;
  }

  const res = await setChatInsTemplateListAPI(JSON.stringify(templates as ChatInstructionTemplate[]));
  if (!res.flag) {
    dsAlert({ type: "error", message: tr("toast.userTemplatesSaveFailed", { error: res.log }) });
    return false;
  }

  return true;
}
