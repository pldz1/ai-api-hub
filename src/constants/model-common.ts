import type { ChatModelEditorState, ImageModelEditorState } from "@/types";

export const defaultChatModelEditorState: ChatModelEditorState = {
  name: "",
  provider: "",
  baseURL: "",
  endpoint: "",
  apiKey: "",
  model: "",
  deployment: "",
  apiVersion: "",
  enabledCapabilitiesMode: "inherit",
  enabledCapabilities: {},
};

export const defaultImageModelEditorState: ImageModelEditorState = {
  name: "",
  provider: "",
  baseURL: "",
  endpoint: "",
  apiKey: "",
  model: "",
  deployment: "",
  apiVersion: "",
  imageOperation: "generation",
};
