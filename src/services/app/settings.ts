import store from "@/store";
import { tr } from "@/i18n";
import { buildModelSettings, sanitizeModelSettings } from "@/models";
import { dsAlert } from "@/utils";
import { apiRequest } from "./storage";
import type { ApiResponse, ModelSettings } from "@/types";

type ChatInstructionTemplate = {
  id: string;
  name: string;
  value: string;
};

const emptyModelSettings = (): ModelSettings => ({
  chat: [],
  image: [],
  video: [],
});

const getModelsAPI = (): Promise<ApiResponse<ModelSettings>> => apiRequest("post", "/_api/workspace/getModels", {});
const setModelsAPI = (data: ModelSettings): Promise<ApiResponse<null>> => apiRequest("post", "/_api/workspace/setModels", { data });
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
    console.error("Failed to fetch model settings:", res.log);
    dsAlert({ type: "error", message: tr("toast.userModelsFetchFailed", { error: res.log }) });
    return false;
  }

  try {
    const parsed = res.data;
    await store.dispatch("setModels", sanitizeModelSettings(parsed as ModelSettings));
    return true;
  } catch (error) {
    await store.dispatch("setModels", emptyModelSettings());
    console.error("Error parsing model settings:", error);
    dsAlert({ type: "error", message: tr("toast.userModelsInvalid", { error: error instanceof Error ? error.message : String(error) }) });
    return false;
  }
}

export async function setModels(models: ModelSettings = store.state.models): Promise<boolean> {
  const payload = buildModelSettings(models);
  const res = await setModelsAPI(payload);
  if (!res.flag) {
    console.error("Failed to save model settings:", res.log);
    dsAlert({ type: "error", message: tr("toast.userModelsSaveFailed", { error: res.log }) });
    return false;
  }

  return true;
}

export async function getChatInsTemplateList(): Promise<boolean> {
  const res = await getChatInsTemplateListAPI();
  if (!res.flag) {
    console.error("Failed to fetch chat instruction templates:", res.log);
    await store.dispatch("setChatInsTemplateList", []);
    dsAlert({ type: "error", message: tr("toast.userTemplatesFetchFailed", { error: res.log }) });
    return false;
  }

  try {
    const templates = parseStoredJson<ChatInstructionTemplate[]>(res.data, []);
    await store.dispatch("setChatInsTemplateList", templates);
    return true;
  } catch (error) {
    await store.dispatch("setChatInsTemplateList", []);
    console.error("Error parsing chat instruction templates:", error);
    dsAlert({ type: "error", message: tr("toast.userTemplatesFetchFailed", { error: error instanceof Error ? error.message : String(error) }) });
    return false;
  }
}

export async function setChatInsTemplateList(templates: unknown[] = store.state.chatInsTemplateList): Promise<boolean> {
  try {
    const res = await setChatInsTemplateListAPI(JSON.stringify(templates as ChatInstructionTemplate[]));

    if (!res.flag) {
      console.error("Failed to save chat instruction templates:", res.log);
      dsAlert({ type: "error", message: tr("toast.userTemplatesSaveFailed", { error: res.log }) });
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error saving chat instruction templates:", error);
    dsAlert({ type: "error", message: tr("toast.userTemplatesSaveFailed", { error: error instanceof Error ? error.message : String(error) }) });
    return false;
  }
}
