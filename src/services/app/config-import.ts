import store from "@/store";
import { migratePersistedModelSettings } from "@/models";
import { dsAlert, getSettingsImportValidationError, isSettingsImportPackage, isValidSettingsImport } from "@/utils";
import { tr } from "@/i18n";
import { importChatSessionSettings } from "../conversation";
import { getModels, setChatInsTemplateList, setModels } from "./settings";
import type { PersistedModelSettingsPayload, SettingsImportPayload } from "@/types";

type ConfigImportSource = "inline" | "url";
export const SETTINGS_IMPORTED_EVENT = "ai-api-hub:settings-imported";

interface ImportConfigOptions {
  notify?: boolean;
  source?: ConfigImportSource;
}

function clonePlainData<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
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

  if (!isValidSettingsImport(data)) {
    const validationError = getSettingsImportValidationError(data);
    if (shouldNotify) {
      dsAlert({
        duration: 5000,
        type: "error",
        message: validationError ? `${tr("user.importInvalid")} ${validationError}` : tr("user.importInvalid"),
      });
    }
    return false;
  }

  if (isSettingsImportPackage(data)) {
    const importedPackage = clonePlainData(data) as SettingsImportPayload;
    const models = migratePersistedModelSettings(importedPackage.models);

    await store.dispatch("setModels", models);
    if (Array.isArray(importedPackage.templates)) {
      await store.dispatch("setChatInsTemplateList", clonePlainData(importedPackage.templates));
    }

    const modelsSaved = await setModels(models);
    const templatesSaved = Array.isArray(importedPackage.templates) ? await setChatInsTemplateList(importedPackage.templates) : true;

    if (Array.isArray(importedPackage.chatSessions)) {
      await importChatSessionSettings(importedPackage.chatSessions);
    }

    if (modelsSaved === false || templatesSaved === false) return false;
  } else {
    const models = migratePersistedModelSettings(clonePlainData(data) as PersistedModelSettingsPayload);
    await store.dispatch("setModels", models);
    if ((await setModels(models)) === false) return false;
  }

  if (shouldNotify) {
    dsAlert({ type: "success", message: tr("user.importSuccess") });
  }
  notifySettingsImported();
  return true;
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
