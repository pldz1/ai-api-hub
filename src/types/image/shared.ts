import type { ImageModelProvider } from "@/services/image/types";

export type ImageFormProvider = ImageModelProvider | "";

export interface ModelConfigBase {
  name: string;
  apiKey: string;
  model: string;
}
