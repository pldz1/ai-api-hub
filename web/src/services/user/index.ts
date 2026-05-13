import store from "@/store";
import { migratePersistedModelSettings, sanitizeModelSettings } from "@/constants";
import { apiRequest } from "../transport/request";
import { dsAlert, isArrayTypeStr, isValidModelSetting } from "@/utils";
import { tr } from "@/i18n";
import type { ApiResponse } from "@/services/types";
import type { ModelSettings } from "@/types/model";

/**
 * User service.
 *
 * Owns workspace bootstrap and persisted user-level settings, including model
 * lists and chat instruction templates.
 */

/**
 * Check the companion service and prepare the current workspace.
 */
export const loginAPI = (): Promise<ApiResponse<null>> => apiRequest("post", "/_api/login", {});

/**
 * Request the saved model configuration.
 */
export const getModelsAPI = (): Promise<ApiResponse<string>> => apiRequest("post", "/_api/user/getModels", {});

/**
 * Save the full model configuration.
 */
export const setModelsAPI = (data: string): Promise<ApiResponse<null>> => apiRequest("post", "/_api/user/setModels", { data });

/**
 * Request the saved chat instruction templates.
 */
export const getChatInsTemplateListAPI = (): Promise<ApiResponse<string>> => apiRequest("post", "/_api/user/getChatInsTemplateList", {});

/**
 * Save the chat instruction templates.
 */
export const setChatInsTemplateListAPI = (data: string): Promise<ApiResponse<null>> => apiRequest("post", "/_api/user/setChatInsTemplateList", { data });

/**
 * Initialize the single-workspace session.
 */
export async function login(): Promise<boolean> {
  const res = await loginAPI();
  if (!res.flag) {
    dsAlert({ type: "error", message: tr("toast.loginFailed", { error: res.log }) });
    return false;
  }

  await store.dispatch("login");
  return true;
}

/**
 * Load chat model settings and optionally update the store.
 */
export async function getModels(updateStore: boolean = true): Promise<ModelSettings | null | false> {
  let res = await getModelsAPI();

  if (!res.flag) {
    dsAlert({ type: "error", message: tr("toast.userModelsFetchFailed", { error: res.log }) });
    return false;
  }

  if (res.data == "") {
    dsAlert({
      type: "warn",
      message: tr("toast.userModelsMissing"),
    });
    return false;
  }

  try {
    const models = JSON.parse(res.data);
    const isValid = isValidModelSetting(models);
    if (isValid) {
      const migratedModels = migratePersistedModelSettings(models);
      if (updateStore) await store.dispatch("setModels", migratedModels);
      return migratedModels;
    } else {
      dsAlert({
        type: "error",
        message: tr("toast.userModelsInvalid", { error: res.data }),
      });
      return null;
    }
  } catch (err) {
    dsAlert({
      type: "error",
      message: tr("toast.userModelsInvalid", { error: `${err}: ${res.data}` }),
    });
    return null;
  }
}

/**
 * Persist the model settings from the store.
 */
export async function setModels(): Promise<boolean> {
  const models = sanitizeModelSettings(store.state.models);
  const res = await setModelsAPI(JSON.stringify(models));
  if (!res.flag) {
    dsAlert({ type: "error", message: tr("toast.userModelsSaveFailed", { error: res.log }) });
    return false;
  }
  return true;
}

/**
 * Load all chat instruction templates into the store.
 */
export async function getChatInsTemplateList(): Promise<boolean> {
  const res = await getChatInsTemplateListAPI();

  if (!res.flag) {
    dsAlert({
      type: "error",
      message: tr("toast.userTemplatesFetchFailed", { error: res.log }),
    });
    return false;
  } else {
    if (isArrayTypeStr(res.data)) {
      await store.dispatch("setChatInsTemplateList", JSON.parse(res.data));
    } else {
      await store.dispatch("setChatInsTemplateList", []);
    }
    return true;
  }
}

/**
 * Save chat instruction templates from the store.
 */
export async function setChatInsTemplateList(data: unknown[]): Promise<boolean> {
  await store.dispatch("setChatInsTemplateList", data);

  const res = await setChatInsTemplateListAPI(JSON.stringify(data));

  if (!res.flag) {
    dsAlert({
      type: "error",
      message: tr("toast.userTemplatesSaveFailed", { error: res.log }),
    });
    return false;
  }
  return true;
}
