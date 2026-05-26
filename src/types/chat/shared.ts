import type { ChatModelProvider } from "@/services/chat/types";

export type ChatFormProvider = ChatModelProvider | "";
export type CapabilityOverrideMode = "inherit" | "custom";
