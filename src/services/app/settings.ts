import store from "@/store";
import { tr } from "@/i18n";
import { buildModelSettings, sanitizeModelSettings } from "@/models";
import { workspaceRepository } from "@/persistence";
import { dsAlert } from "@/utils";
import type { ModelSettings } from "@/types";

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

export async function getModels(): Promise<boolean> {
  try {
    const models = sanitizeModelSettings(workspaceRepository.getModels());
    store.commit("setModels", models);
    return true;
  } catch (error) {
    store.commit("setModels", emptyModelSettings());
    console.error("Failed to load model settings:", error);
    dsAlert({ type: "error", message: tr("toast.userModelsFetchFailed", { error: error instanceof Error ? error.message : String(error) }) });
    return false;
  }
}

export async function setModels(models: ModelSettings = store.state.models): Promise<boolean> {
  try {
    workspaceRepository.saveModels(buildModelSettings(models));
    return true;
  } catch (error) {
    console.error("Failed to save model settings:", error);
    dsAlert({ type: "error", message: tr("toast.userModelsSaveFailed", { error: error instanceof Error ? error.message : String(error) }) });
    return false;
  }
}

export async function getChatInsTemplateList(): Promise<boolean> {
  try {
    const templates = workspaceRepository.getChatInstructionTemplates() as ChatInstructionTemplate[];
    store.commit("setChatInsTemplateList", templates);
    return true;
  } catch (error) {
    console.error("Failed to load chat instruction templates:", error);
    store.commit("setChatInsTemplateList", []);
    dsAlert({ type: "error", message: tr("toast.userTemplatesFetchFailed", { error: error instanceof Error ? error.message : String(error) }) });
    return false;
  }
}

export async function setChatInsTemplateList(templates: unknown[] = store.state.chatInsTemplateList): Promise<boolean> {
  try {
    workspaceRepository.saveChatInstructionTemplates(templates as ChatInstructionTemplate[]);
    return true;
  } catch (error) {
    console.error("Error saving chat instruction templates:", error);
    dsAlert({ type: "error", message: tr("toast.userTemplatesSaveFailed", { error: error instanceof Error ? error.message : String(error) }) });
    return false;
  }
}
