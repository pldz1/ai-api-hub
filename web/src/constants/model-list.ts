import type { ChatModelCapabilities, ChatModelOption, ModelProvider } from "@/types";

export type ChatModelCatalogItem = ChatModelOption & {
  provider?: ModelProvider;
  chatParamKeys: string[];
};

export type ChatModelCatalogInput = {
  value: string;
  provider?: ModelProvider;
  capabilities: Pick<ChatModelCapabilities, "webSearch" | "reasoning" | "imageRead">;
  chatParamKeys: string[];
  msgTypeVersion?: "v1" | "v2";
};

export const chatModelCatalog: ChatModelCatalogItem[] = [
  {
    value: "gpt-5.5",
    name: "gpt-5.5",
    isReasonModel: true,
    msgTypeVersion: "v2",
    capabilities: { webSearch: true, reasoning: true, imageRead: true },
    chatParamKeys: ["max_completion_tokens", "reasoning_effort", "verbosity"],
  },
  {
    value: "gpt-5.5-pro",
    name: "gpt-5.5-pro",
    isReasonModel: true,
    msgTypeVersion: "v2",
    capabilities: { webSearch: true, reasoning: true, imageRead: true },
    chatParamKeys: ["max_completion_tokens", "reasoning_effort", "verbosity"],
  },
  {
    value: "gpt-5.4",
    name: "gpt-5.4",
    isReasonModel: true,
    msgTypeVersion: "v2",
    capabilities: { webSearch: true, reasoning: true, imageRead: true },
    chatParamKeys: ["max_completion_tokens", "reasoning_effort", "verbosity"],
  },
  {
    value: "gpt-5.4-pro",
    name: "gpt-5.4-pro",
    isReasonModel: true,
    msgTypeVersion: "v2",
    capabilities: { webSearch: true, reasoning: true, imageRead: true },
    chatParamKeys: ["max_completion_tokens", "reasoning_effort", "verbosity"],
  },
  {
    value: "gpt-5.4-mini",
    name: "gpt-5.4-mini",
    isReasonModel: true,
    msgTypeVersion: "v2",
    capabilities: { webSearch: false, reasoning: true, imageRead: true },
    chatParamKeys: ["max_completion_tokens", "reasoning_effort", "verbosity"],
  },
  {
    value: "gpt-5.4-nano",
    name: "gpt-5.4-nano",
    isReasonModel: true,
    msgTypeVersion: "v2",
    capabilities: { webSearch: false, reasoning: true, imageRead: false },
    chatParamKeys: ["max_completion_tokens", "reasoning_effort", "verbosity"],
  },
  {
    value: "gpt-5.2",
    name: "gpt-5.2",
    isReasonModel: true,
    msgTypeVersion: "v2",
    capabilities: { webSearch: true, reasoning: true, imageRead: true },
    chatParamKeys: ["max_completion_tokens", "reasoning_effort", "verbosity"],
  },
  {
    value: "gpt-5",
    name: "gpt-5",
    isReasonModel: true,
    msgTypeVersion: "v2",
    capabilities: { webSearch: true, reasoning: true, imageRead: true },
    chatParamKeys: ["max_completion_tokens", "reasoning_effort", "verbosity"],
  },
  {
    value: "gpt-5-mini",
    name: "gpt-5-mini",
    isReasonModel: true,
    msgTypeVersion: "v2",
    capabilities: { webSearch: false, reasoning: true, imageRead: true },
    chatParamKeys: ["max_completion_tokens", "reasoning_effort", "verbosity"],
  },
  {
    value: "gpt-5-nano",
    name: "gpt-5-nano",
    isReasonModel: true,
    msgTypeVersion: "v2",
    capabilities: { webSearch: false, reasoning: true, imageRead: false },
    chatParamKeys: ["max_completion_tokens", "reasoning_effort", "verbosity"],
  },
  {
    value: "gpt-4.1",
    name: "gpt-4.1",
    isReasonModel: false,
    msgTypeVersion: "v2",
    capabilities: { webSearch: true, reasoning: false, imageRead: true },
    chatParamKeys: ["max_completion_tokens", "temperature", "top_p", "frequency_penalty", "presence_penalty", "stop"],
  },
  {
    value: "gpt-4.1-mini",
    name: "gpt-4.1-mini",
    isReasonModel: false,
    msgTypeVersion: "v2",
    capabilities: { webSearch: false, reasoning: false, imageRead: true },
    chatParamKeys: ["max_completion_tokens", "temperature", "top_p", "frequency_penalty", "presence_penalty", "stop"],
  },
  {
    value: "gpt-4.1-nano",
    name: "gpt-4.1-nano",
    isReasonModel: false,
    msgTypeVersion: "v2",
    capabilities: { webSearch: false, reasoning: false, imageRead: false },
    chatParamKeys: ["max_completion_tokens", "temperature", "top_p", "frequency_penalty", "presence_penalty", "stop"],
  },
  {
    value: "gpt-4o",
    name: "gpt-4o",
    isReasonModel: false,
    msgTypeVersion: "v2",
    capabilities: { webSearch: true, reasoning: false, imageRead: true },
    chatParamKeys: ["max_completion_tokens", "temperature", "top_p", "frequency_penalty", "presence_penalty"],
  },
  {
    value: "gpt-4o-mini",
    name: "gpt-4o-mini",
    isReasonModel: false,
    msgTypeVersion: "v2",
    capabilities: { webSearch: false, reasoning: false, imageRead: true },
    chatParamKeys: ["max_completion_tokens", "temperature", "top_p", "frequency_penalty", "presence_penalty"],
  },
  {
    value: "gpt-4-turbo",
    name: "gpt-4-turbo",
    isReasonModel: false,
    msgTypeVersion: "v2",
    capabilities: { webSearch: false, reasoning: false, imageRead: true },
    chatParamKeys: ["max_tokens", "temperature", "top_p", "frequency_penalty", "presence_penalty"],
  },
  {
    value: "gpt-3.5-turbo",
    name: "gpt-3.5-turbo",
    isReasonModel: false,
    msgTypeVersion: "v1",
    capabilities: { webSearch: false, reasoning: false, imageRead: false },
    chatParamKeys: ["max_tokens", "temperature", "top_p", "frequency_penalty", "presence_penalty", "stop"],
  },
  {
    value: "o1",
    name: "o1",
    isReasonModel: true,
    msgTypeVersion: "v2",
    capabilities: { webSearch: false, reasoning: true, imageRead: false },
    chatParamKeys: ["max_completion_tokens", "reasoning_effort"],
  },
  {
    value: "o3",
    name: "o3",
    isReasonModel: true,
    msgTypeVersion: "v2",
    capabilities: { webSearch: false, reasoning: true, imageRead: false },
    chatParamKeys: ["max_completion_tokens", "reasoning_effort"],
  },
  {
    value: "o4-mini",
    name: "o4-mini",
    isReasonModel: true,
    msgTypeVersion: "v2",
    capabilities: { webSearch: false, reasoning: true, imageRead: false },
    chatParamKeys: ["max_completion_tokens", "reasoning_effort"],
  },
  {
    value: "claude-opus-4-7",
    name: "claude-opus-4-7",
    isReasonModel: false,
    msgTypeVersion: "v2",
    capabilities: { webSearch: false, reasoning: false, imageRead: true },
    chatParamKeys: ["max_tokens", "temperature", "top_p", "stop"],
  },
  {
    value: "claude-sonnet-4-6",
    name: "claude-sonnet-4-6",
    isReasonModel: false,
    msgTypeVersion: "v2",
    capabilities: { webSearch: false, reasoning: false, imageRead: true },
    chatParamKeys: ["max_tokens", "temperature", "top_p", "stop"],
  },
  {
    value: "claude-haiku-4-5",
    name: "claude-haiku-4-5",
    isReasonModel: false,
    msgTypeVersion: "v2",
    capabilities: { webSearch: false, reasoning: false, imageRead: true },
    chatParamKeys: ["max_tokens", "temperature", "top_p", "stop"],
  },
];
