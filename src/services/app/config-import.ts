import store from "@/store";
import { sanitizeModelSettings } from "@/models";
import { dsAlert, uploadJsonFile } from "@/utils";
import { tr } from "@/i18n";
import { getModels, setChatInsTemplateList, setModels } from "./settings";
import type { ModelSettings, SettingsImportPayload } from "@/types";

type ConfigImportSource = "inline" | "url";
export const SETTINGS_IMPORTED_EVENT = "ai-api-hub:settings-imported";

interface ImportConfigOptions {
  notify?: boolean;
  source?: ConfigImportSource;
}

interface UploadedJsonParseError {
  __jsonParseError: string;
}

export function getInitialRoutePassword(): string {
  const search = window.location.search || "";
  const hash = window.location.hash || "";
  const match = (search + hash).match(/[?&]password=([^&#]+)/);
  return match ? decodeURIComponent(match[1].replace(/\+/g, "%20")) : "";
}

function clonePlainData<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

function isUploadedJsonParseError(data: unknown): data is UploadedJsonParseError {
  return Boolean(data) && typeof data === "object" && "__jsonParseError" in data;
}

function normalizeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;
  return padding ? `${normalized}${"=".repeat(4 - padding)}` : normalized;
}

function decodeBase64Json(value: string): string {
  const binary = window.atob(normalizeBase64Url(value));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function parseInlineConfig(value: string): unknown {
  const trimmedValue = value.trim();
  if (!trimmedValue) throw new Error("Empty config");

  try {
    return JSON.parse(trimmedValue);
  } catch {
    return JSON.parse(decodeBase64Json(trimmedValue));
  }
}

async function readConfigPayload(configValue: string, source: ConfigImportSource): Promise<unknown> {
  if (source === "url") {
    const response = await fetch(configValue, {
      headers: {
        Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
      },
    });
    return await parseJsonResponse(response);
  }

  return parseInlineConfig(configValue);
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text.slice(0, 160)}`);

  const trimmedText = text.trim();
  if (trimmedText.startsWith("<!doctype") || trimmedText.startsWith("<html")) {
    throw new Error("Config URL returned HTML instead of JSON.");
  }

  return JSON.parse(text);
}

function notifySettingsImported(): void {
  window.dispatchEvent(new CustomEvent(SETTINGS_IMPORTED_EVENT));
}

export function getInitialRouteConfigValue(routeText = ""): string {
  const currentRoute = routeText || `${window.location.search || ""}${window.location.hash || ""}`;
  const match = currentRoute.match(/[?&]config=([^&#]+)/);
  return match ? decodeURIComponent(match[1].replace(/\+/g, "%20")) : "";
}

export function getConfigImportSource(configValue: string): ConfigImportSource {
  return /^https?:\/\//i.test(configValue.trim()) ? "url" : "inline";
}

export async function importSettingsPayload(data: unknown, options: ImportConfigOptions = {}): Promise<boolean> {
  const shouldNotify = options.notify !== false;
  const currentModels = clonePlainData(store.state.models);
  const currentTemplates = clonePlainData(store.state.chatInsTemplateList);

  try {
    const importedPackage = clonePlainData(data) as Partial<SettingsImportPayload> & Partial<ModelSettings>;
    const modelSource = importedPackage && typeof importedPackage === "object" && "models" in importedPackage ? importedPackage.models : importedPackage;
    if (
      !modelSource ||
      typeof modelSource !== "object" ||
      (!Array.isArray((modelSource as Partial<ModelSettings>).chat) &&
        !Array.isArray((modelSource as Partial<ModelSettings>).image) &&
        !Array.isArray((modelSource as Partial<ModelSettings>).video))
    ) {
      throw new Error("Invalid config: missing model settings.");
    }

    const models = sanitizeModelSettings(modelSource as Partial<ModelSettings>);
    const templates = "models" in importedPackage && Array.isArray(importedPackage.templates) ? clonePlainData(importedPackage.templates) : undefined;

    store.commit("setModels", models);
    if (Array.isArray(templates)) {
      store.commit("setChatInsTemplateList", templates);
    }

    const modelsSaved = await setModels(models);
    const templatesSaved = Array.isArray(templates) ? await setChatInsTemplateList(templates) : true;

    if (modelsSaved === false || templatesSaved === false) {
      store.commit("setModels", currentModels);
      store.commit("setChatInsTemplateList", currentTemplates);
      return false;
    }
  } catch (error) {
    store.commit("setModels", currentModels);
    store.commit("setChatInsTemplateList", currentTemplates);
    console.error("Failed to import settings:", error);
    if (shouldNotify) {
      dsAlert({ type: "error", message: tr("user.importFailed", { error: error instanceof Error ? error.message : String(error) }) });
    }
    return false;
  }

  if (shouldNotify) {
    dsAlert({ type: "success", message: tr("user.importSuccess") });
  }
  notifySettingsImported();
  return true;
}

export async function importSettingsFromUploadedJsonFile(options: ImportConfigOptions = {}): Promise<boolean> {
  const jsonData = await uploadJsonFile();

  if (isUploadedJsonParseError(jsonData)) {
    console.error("Failed to parse imported settings:", jsonData.__jsonParseError);
    if (options.notify !== false) {
      dsAlert({ type: "error", duration: 6000, message: `${tr("user.importReadError")} ${jsonData.__jsonParseError}` });
    }
    return false;
  }

  if (!jsonData) {
    console.error("Failed to read imported settings file.");
    if (options.notify !== false) {
      dsAlert({ type: "error", message: tr("user.importReadError") });
    }
    return false;
  }

  return importSettingsPayload(jsonData, options);
}

export async function importSettingsFromConfigValue(configValue: string, options: ImportConfigOptions = {}): Promise<boolean> {
  const source = options.source || getConfigImportSource(configValue);

  try {
    const payload = await readConfigPayload(configValue, source);
    const imported = await importSettingsPayload(payload, options);
    if (imported) await getModels();
    return imported;
  } catch (error) {
    if (options.notify !== false) {
      dsAlert({
        type: "error",
        duration: 6000,
        message: `${tr("user.importReadError")} ${error instanceof Error ? error.message : String(error)}`,
      });
    }
    return false;
  }
}
