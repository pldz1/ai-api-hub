import type { SelectOption } from "@/types/chat";

export interface RealtimeAudioRuntimeCapabilities {
  transport: "websocket";
  inputAudio: boolean;
  outputAudio: boolean;
}

export const realtimeAudioModelTypeList: SelectOption[] = [
  { value: "gpt-4o-realtime-preview", name: "gpt-4o-realtime-preview" },
  { value: "gpt-4o-mini-realtime-preview", name: "gpt-4o-mini-realtime-preview" },
];
