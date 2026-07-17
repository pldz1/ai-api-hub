import type { ModelSettings } from "@/types";
import { readBrowserWorkspace, updateBrowserWorkspace } from "./state";

export const workspaceRepository = {
  getModels(): ModelSettings {
    return readBrowserWorkspace().models;
  },

  saveModels(models: ModelSettings): void {
    updateBrowserWorkspace((state) => {
      state.models = models;
    });
  },

  getChatInstructionTemplates(): unknown[] {
    return readBrowserWorkspace().chatInstructionTemplates;
  },

  saveChatInstructionTemplates(templates: unknown[]): void {
    updateBrowserWorkspace((state) => {
      state.chatInstructionTemplates = templates;
    });
  },
};
