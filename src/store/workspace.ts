import { normalizeChatModelConfig, sanitizeModelSettings } from "@/models";
import type { ChatModelConfig, ModelSettings } from "@/types";

export interface ChatInstructionTemplate {
  id: string;
  name: string;
  value: string;
}

/** Reactive workspace settings only; persistence belongs to repositories. */
export const WorkspaceState = {
  models: { chat: [], image: [], video: [] } as ModelSettings,
  curChatModel: null as ChatModelConfig | null,
  chatInsTemplateList: [] as ChatInstructionTemplate[],
  curChatId: "",

  setModels(data: unknown) {
    this.models = sanitizeModelSettings(data);
  },

  setChatInsTemplateList(data: ChatInstructionTemplate[]) {
    this.chatInsTemplateList = Array.isArray(data) ? data : [];
  },

  setCurChatModel(data: unknown) {
    this.curChatModel = data ? normalizeChatModelConfig(data) : null;
  },

  setCurChatId(data: string) {
    this.curChatId = data;
  },
};
