import type { ModelFormDraft } from "@/types/model";

export const defaultModelFormDraft: ModelFormDraft = {
  name: "",
  provider: "",
  baseURL: "",
  endpoint: "",
  apiKey: "",
  model: "",
  deployment: "",
  apiVersion: "",
  imageOperation: "",
  enabledCapabilitiesMode: "inherit",
  enabledCapabilities: {},
};
