import { chatParamList } from "@/ai-capability";
import type { ModelParamDef, ChatModelEditorState } from "@/types";

function transformToPresetList(originalList) {
  const descriptionMapping = {
    max_tokens: { descriptionKey: "chat.maxTokensTip" },
    max_output_tokens: { descriptionKey: "chat.maxCompletionTokensTip" },
    temperature: { descriptionKey: "chat.temperatureTip" },
    top_p: { descriptionKey: "chat.topPTip" },
    frequency_penalty: { descriptionKey: "chat.frequencyPenaltyTip" },
    presence_penalty: { descriptionKey: "chat.presencePenaltyTip" },
    reasoning_effort: { descriptionKey: "chat.reasoningEffortTip" },
    verbosity: { descriptionKey: "chat.verbosityTip" },
    thinking: { description: "DeepSeek thinking configuration." },
  };

  return originalList.map((item) => {
    const matchedDesc = descriptionMapping[item.key];

    return {
      ...item,
      ...matchedDesc,
    };
  });
}

export const chatParamPresetList: Partial<ModelParamDef>[] = transformToPresetList(chatParamList);

export const defaultChatModelEditorState: ChatModelEditorState = {
  name: "",
  provider: "",
  baseURL: "",
  apiKey: "",
  model: "",
};

export { chatProviderKeys, chatModelCatalog, chatModelTypeList, defaultModelCapabilities, chatDisplayedCapabilityKeys } from "@/ai-capability/chat";
