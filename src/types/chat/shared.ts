import type { ChatModelProvider } from "@/services/chat/types";

export type ChatFormProvider = ChatModelProvider | "";
export type CapabilityOverrideMode = "inherit" | "custom";

export interface ModelConfigBase {
  name: string;
  apiKey: string;
  model: string;
}
