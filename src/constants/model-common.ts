import type { ChatModelEditorState } from "@/types/chat";
import type { ImageModelEditorState } from "@/types/image";

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
