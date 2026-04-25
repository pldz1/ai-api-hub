import store from "@/store";
import { apiRequest } from "./axios-request.js";
import { dsAlert, isArrayTypeStr, isValidModelSetting } from "@/utils";
import { tr } from "@/i18n";

/**
 * 探测 companion service 是否可用，并准备当前工作区
 * @return {Promise<{ flag: boolean, uid: string, log: string, role: string }>}
 */
export const loginAPI = () => apiRequest("post", "/_api/login", {});

/**
 * 发送获得全部模型内容的请求
 * @return {Promise<{ flag: boolean, data: string, log: string }>}
 */
export const getModelsAPI = () => apiRequest("post", "/_api/user/getModels", {});

/**
 * 发送全部模型的请求
 * @return {Promise<{ flag: boolean, data: string, log: string }>}
 */
export const setModelsAPI = (data) => apiRequest("post", "/_api/user/setModels", { data });

/**
 * 发送获得对话模型的全部内容的请求
 * @return {Promise<{ flag: boolean, data: string, log: string }>}
 */
export const getChatInsTemplateListAPI = () => apiRequest("post", "/_api/user/getChatInsTemplateList", {});

/**
 * 发送设置对话模型的请求
 * @return {Promise<{ flag: boolean, data: string, log: string }>}
 */
export const setChatInsTemplateListAPI = (data) => apiRequest("post", "/_api/user/setChatInsTemplateList", { data });

/**
 * 初始化单工作区会话
 * @return {Promise<boolean>}
 */
export async function login() {
  const res = await loginAPI();
  if (!res.flag) {
    dsAlert({ type: "error", message: tr("toast.loginFailed", { error: res.log }) });
    return false;
  }

  await store.dispatch("login");
  return true;
}

/**
 * 获取全部的对话模型信息然后更新store
 * @returns {Promise<object | null>}
 */
export async function getModels(updateStore = true) {
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
      if (updateStore) await store.dispatch("setModels", models);
      return models;
    } else {
      dsAlert({
        type: "error",
        message: tr("toast.userModelsInvalid", { error: `${err}: ${res.data}` }),
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
 * 将store内用到的全部模型存到数据库
 * @returns {Promise<boolean>}
 */
export async function setModels() {
  const models = store.state.models;
  const res = await setModelsAPI(JSON.stringify(models));
  if (!res.flag) {
    dsAlert({ type: "error", message: tr("toast.userModelsSaveFailed", { error: res.log }) });
    return false;
  }
  return true;
}

/**
 * 获取全部的对话指令
 * @returns {Promise<boolean>}
 */
export async function getChatInsTemplateList() {
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
 * 获取全部的对话指令模板
 * @returns {Promise<boolean>}
 */
export async function setChatInsTemplateList(data) {
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
