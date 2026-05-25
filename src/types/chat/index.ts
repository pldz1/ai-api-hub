export * from "./shared";
export * from "./provider";
export * from "./model";

export type { ModelConfigBase as ChatModelConfigBase } from "./shared";

// Re-export AI-capability primitives under app-friendly aliases.
export type {
  ModelParamDef as ChatModelParamDef,
  ModelParamType as ChatModelParamType,
  ParamDefaultValue as ChatParamDefaultValue,
  SelectOption as ChatSelectOption,
} from "@/services/chat/types";
