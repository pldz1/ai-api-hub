import store from "@/store";
import { apiRequest } from "./axios-request.js";
import { dsAlert, getUuid } from "@/utils";
import { tr } from "@/i18n";

const DEFAULT_IMAGE_QUALITY = "low";
const DEFAULT_IMAGE_OUTPUT_FORMAT = "png";

function trimTrailingSlash(value = "") {
  return String(value || "").replace(/\/+$/, "");
}

function buildImageGenerationRequest(model, params) {
  const apiType = model?.apiType;
  const prompt = params?.prompt || "";
  const size = params?.size || "1024x1024";
  const n = params?.n || 1;
  const quality = params?.quality || DEFAULT_IMAGE_QUALITY;
  const outputFormat = params?.outputFormat || DEFAULT_IMAGE_OUTPUT_FORMAT;

  if (apiType === "Fetch") {
    const url = String(model?.baseURL || "").trim();

    if (!url || !model?.apiKey) {
      throw new Error("图像模型 URL 或 API Key 未配置");
    }

    return {
      url,
      headers: {
        accept: "application/json",
        "api-key": model.apiKey,
        "content-type": "application/json",
      },
      body: {
        size,
        quality,
        output_format: outputFormat,
        n,
        prompt,
      },
    };
  }

  if (apiType === "Azure OpenAI") {
    const endpoint = trimTrailingSlash(model?.endpoint);
    const deployment = model?.deployment || model?.model || model?.modelType;
    const apiVersion = model?.apiVersion;

    if (!endpoint || !model?.apiKey || !deployment || !apiVersion) {
      throw new Error("Azure OpenAI 图像模型配置不完整");
    }

    return {
      url: `${endpoint}/openai/deployments/${encodeURIComponent(deployment)}/images/generations?api-version=${encodeURIComponent(apiVersion)}`,
      headers: {
        accept: "application/json",
        "api-key": model.apiKey,
        "content-type": "application/json",
      },
      body: {
        size,
        quality,
        output_format: outputFormat,
        n,
        prompt,
      },
    };
  }

  if (apiType === "OpenAI") {
    const baseURL = trimTrailingSlash(model?.baseURL || "https://api.openai.com/v1");
    const imageModel = model?.model || model?.modelType;

    if (!baseURL || !model?.apiKey || !imageModel) {
      throw new Error("OpenAI 图像模型配置不完整");
    }

    return {
      url: `${baseURL}/images/generations`,
      headers: {
        accept: "application/json",
        authorization: `Bearer ${model.apiKey}`,
        "content-type": "application/json",
      },
      body: {
        model: imageModel,
        size,
        quality,
        output_format: outputFormat,
        n,
        prompt,
      },
    };
  }

  throw new Error(`${apiType || "当前"} 图像模型暂不支持 fetch 生图`);
}

function normalizeImageGenerationData(data) {
  if (!Array.isArray(data?.data)) {
    const message = data?.error?.message || data?.message || JSON.stringify(data);
    return [{ type: "text", data: message || "图像接口返回格式无效" }];
  }

  return data.data.map((item) => {
    if (item?.url) {
      return { type: "url", data: item.url };
    }

    if (item?.b64_json) {
      return { type: "url", data: `data:image/png;base64,${item.b64_json}` };
    }

    return { type: "text", data: item?.error?.message || "图像接口未返回图片数据" };
  });
}

/**
 * 获取全部的图像列表
 * @return {Promise<{ flag: boolean, log: string, data:T_ImageDataItem[] }>} 服务器返回的结果
 */
export const getImageListAPI = () => apiRequest("post", "/_api/image/getImageList", {});

/**
 * 添加一张图像数据
 * @return {Promise<{ flag: boolean, log: string, data:string }>} 服务器返回的结果
 */
export const pushImageAPI = (id, prompt, url) =>
  apiRequest("post", "/_api/image/pushImage", {
    image_id: id,
    image_prompt: prompt,
    image_url: url,
  });

/**
 * 删除一张图像数据
 * @return {Promise<{ flag: boolean, log: string }>} 服务器返回的结果
 */
export const deleteImageAPI = (id) =>
  apiRequest("post", "/_api/image/deleteImage", {
    image_id: id,
  });

/**
 * 生成图片
 * @param {T_ModelType} model - 当前选择的图像模型配置
 * @param {{ prompt: string, size: string, n: number, quality?: string, outputFormat?: string }} params - 生成参数
 * @returns {Promise<Array<{ type: string, data: string }>>} 返回包含图片 URL/base64 data URL 或错误信息的数组
 */
export async function generateImage(model, params) {
  try {
    const request = buildImageGenerationRequest(model, params);
    const res = await fetch(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify(request.body),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const message = data?.error?.message || data?.message || `${res.status} ${res.statusText}`;
      return [{ type: "text", data: message }];
    }

    return normalizeImageGenerationData(data);
  } catch (err) {
    return [{ type: "text", data: String(err) }];
  }
}

/**
 * 获取全部的图像列表
 */
export async function getImageList() {
  const res = await getImageListAPI();
  if (!res.flag) {
    await store.dispatch("resetImageList", []);
    dsAlert({ type: "error", message: tr("toast.imageListFetchFailed", { error: res.log }) });
    return false;
  } else {
    if (Array.isArray(res.data)) {
      const reversed = res.data.slice().reverse();
      await store.dispatch("resetImageList", reversed);
    } else {
      await store.dispatch("resetImageList", []);
      dsAlert({
        type: "error",
        message: tr("toast.imageListInvalid"),
      });
    }
  }
}

/**
 * 增加一张图像
 * @return {Promise<boolean}>} 操作的结果
 */
export async function pushImage(prompt, url) {
  // 直接塞入url 比较省事
  const id = getUuid("img");
  await store.dispatch("pushImage", { id: id, prompt: prompt, src: url });
  const res = await pushImageAPI(id, prompt, url);
  if (!res.flag) {
    dsAlert({
      type: "error",
      message: tr("toast.imagePushFailed", { error: res.log }),
    });
    return false;
  } else {
    if (res.data?.src) {
      const nextImageList = store.state.imageList.map((item) => {
        return item.id === id ? { ...item, src: res.data.src } : item;
      });
      await store.dispatch("resetImageList", nextImageList);
    }
    return true;
  }
}

/**
 * 删除一张图像数据
 * @return {Promise<boolean}>} 操作的结果
 */
export async function deleteImage(id) {
  await store.dispatch("deleteImage", id);
  const res = await deleteImageAPI(id);
  if (!res.flag) {
    dsAlert({
      type: "error",
      message: tr("toast.imageDeleteFailed", { error: res.log }),
    });
    return false;
  }

  return true;
}
