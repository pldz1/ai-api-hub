import type { ChatModelCapabilities } from "@/services/chat/types";
import type { CapabilityOverrideMode, ModelConfigBase } from "./shared";

/**
 * User-owned chat model configuration.
 *
 * This is the stable payload that settings pages edit, storage persists, and
 * import/export writes to JSON. It intentionally represents what the user
 * configured, not the final provider client constructor args used at runtime.
 */
export interface ChatProviderPayloadBase extends ModelConfigBase {
  enabledCapabilitiesMode?: CapabilityOverrideMode;
  enabledCapabilities?: Partial<ChatModelCapabilities>;
}

/** Chat model payload for direct OpenAI-compatible routing. */
export interface OpenAIChatProviderPayload extends ChatProviderPayloadBase {
  provider: "OpenAI";
  baseURL: string;
}

/** Chat model payload for Azure OpenAI routing via endpoint + deployment. */
export interface AzureOpenAIChatProviderPayload extends ChatProviderPayloadBase {
  provider: "Azure OpenAI";
  endpoint: string;
  deployment: string;
  apiVersion: string;
}

/** Chat model payload for Anthropic direct API routing. */
export interface AnthropicChatProviderPayload extends ChatProviderPayloadBase {
  provider: "Anthropic";
  baseURL: string;
}

/** Chat model payload for Azure AI Foundry's Anthropic-compatible routing. */
export interface AzureAIFoundryChatProviderPayload extends ChatProviderPayloadBase {
  provider: "Azure AI Foundry";
  baseURL: string;
}

/** Provider payloads that share the Anthropic request protocol. */
export type AnthropicCompatibleChatProviderPayload = AnthropicChatProviderPayload | AzureAIFoundryChatProviderPayload;
/** Provider payloads that use a base URL instead of Azure deployment routing. */
export type OpenAIStyleChatProviderPayload = OpenAIChatProviderPayload | AnthropicCompatibleChatProviderPayload;
/** All persisted chat model payloads owned by the user. */
export type ChatProviderPayload = OpenAIChatProviderPayload | AzureOpenAIChatProviderPayload | AnthropicCompatibleChatProviderPayload;
