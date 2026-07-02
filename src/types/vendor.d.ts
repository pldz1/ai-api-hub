declare module "mammoth" {
  export interface ExtractRawTextInput {
    arrayBuffer: ArrayBuffer;
  }

  export interface ExtractRawTextResult {
    value: string;
    messages: unknown[];
  }

  export function extractRawText(input: ExtractRawTextInput): Promise<ExtractRawTextResult>;
}
