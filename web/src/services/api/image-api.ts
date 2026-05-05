// @ts-nocheck
import store from "@/store";
import { apiRequest } from "./axios-request";
import { getModelRequestId } from "@/constants";
import { dsAlert, getUuid } from "@/utils";
import { tr } from "@/i18n";

const DEFAULT_IMAGE_QUALITY = "auto";
const DEFAULT_IMAGE_OUTPUT_FORMAT = "png";
const IMAGE_OPERATION_ENDPOINT = {
  create: "generations",
  edit: "edits",
};

function trimTrailingSlash(value = "") {
  return String(value || "").replace(/\/+$/, "");
}

function resolveImageEndpointUrl(url = "", hasInputImage = false) {
  const trimmedUrl = String(url || "").trim();
  if (!hasInputImage) return trimmedUrl;

  return trimmedUrl.replace(/\/images\/generations(?=($|[?#]))/, `/images/${IMAGE_OPERATION_ENDPOINT.edit}`);
}

function buildOpenAIImageEndpointUrl(baseURL = "", hasInputImage = false) {
  const trimmedUrl = trimTrailingSlash(baseURL || "https://api.openai.com/v1");
  const endpoint = hasInputImage ? IMAGE_OPERATION_ENDPOINT.edit : IMAGE_OPERATION_ENDPOINT.create;

  if (/\/images\/(generations|edits)(?=($|[?#]))/.test(trimmedUrl)) {
    return resolveImageEndpointUrl(trimmedUrl, hasInputImage);
  }

  return `${trimmedUrl}/images/${endpoint}`;
}

function isImageParamValue(value) {
  return Boolean(value?.filename && value?.content_type && value?.data);
}

function base64ToBlob(base64Data, contentType = "image/png") {
  const byteCharacters = atob(String(base64Data || ""));
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
    const slice = byteCharacters.slice(offset, offset + 1024);
    const byteNumbers = new Array(slice.length);

    for (let index = 0; index < slice.length; index += 1) {
      byteNumbers[index] = slice.charCodeAt(index);
    }

    byteArrays.push(new Uint8Array(byteNumbers));
  }

  return new Blob(byteArrays, { type: contentType });
}

function hasImageInput(params = {}) {
  return Object.values(params || {}).some((value) => isImageParamValue(value));
}

function appendFormDataValue(formData, key, value) {
  if (value === undefined || value === null || value === "") return;

  if (isImageParamValue(value)) {
    formData.append(key, base64ToBlob(value.data, value.content_type), value.filename);
    return;
  }

  if (typeof value === "object") {
    formData.append(key, JSON.stringify(value));
    return;
  }

  formData.append(key, String(value));
}

function buildImageFormData(body = {}, options = {}) {
  const formData = new FormData();

  Object.entries(body).forEach(([key, value]) => {
    if (options.omitModel && key === "model") return;
    appendFormDataValue(formData, key, value);
  });

  return formData;
}

function buildImageRequest(model, params) {
  const prompt = params?.prompt || "";
  const size = params?.size || "1024x1024";
  const n = params?.n || 1;
  const quality = params?.quality || DEFAULT_IMAGE_QUALITY;
  const outputFormat = params?.outputFormat || DEFAULT_IMAGE_OUTPUT_FORMAT;
  const imageModel = getModelRequestId(model);
  const extraParams = Object.fromEntries(
    Object.entries(params || {}).filter(([key, value]) => {
      if (["prompt", "size", "n", "quality", "outputFormat"].includes(key)) return false;
      if (value === undefined || value === null || value === "") return false;
      return true;
    }),
  );
  const baseBody = {
    size,
    quality,
    output_format: outputFormat,
    n,
    prompt,
    ...(imageModel ? { model: imageModel } : {}),
    ...extraParams,
  };
  const hasInputImage = hasImageInput(baseBody);

  const url = buildOpenAIImageEndpointUrl(model?.baseURL, hasInputImage);

  if (!url || !model?.apiKey) {
    throw new Error("OpenAI 图像模型配置不完整");
  }

  return {
    url,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${model.apiKey}`,
      ...(!hasInputImage ? { "content-type": "application/json" } : {}),
    },
    body: hasInputImage ? buildImageFormData(baseBody) : baseBody,
    isFormData: hasInputImage,
  };
}

function normalizeImageGenerationData(data) {
  if (!Array.isArray(data?.data)) {
    const message = data?.error?.message || data?.message || JSON.stringify(data);
    return {
      images: [{ type: "text", data: message || "图像接口返回格式无效" }],
      usage: normalizeImageUsage(data?.usage),
      raw: data,
    };
  }

  const images = data.data.map((item) => {
    if (item?.url) {
      return { type: "url", data: item.url };
    }

    if (item?.b64_json) {
      return { type: "url", data: `data:image/png;base64,${item.b64_json}` };
    }

    return { type: "text", data: item?.error?.message || "图像接口未返回图片数据" };
  });

  return {
    images,
    usage: normalizeImageUsage(data?.usage),
    raw: data,
  };
}

function normalizeImageUsage(usage = null) {
  if (!usage || typeof usage !== "object") {
    return {
      input_tokens: 0,
      output_tokens: 0,
      total_tokens: 0,
    };
  }

  const inputTokens = Number(usage.input_tokens ?? usage.prompt_tokens ?? 0);
  const outputTokens = Number(usage.output_tokens ?? usage.completion_tokens ?? 0);
  const totalTokens = Number(usage.total_tokens ?? inputTokens + outputTokens);

  return {
    ...usage,
    input_tokens: Number.isFinite(inputTokens) ? inputTokens : 0,
    output_tokens: Number.isFinite(outputTokens) ? outputTokens : 0,
    total_tokens: Number.isFinite(totalTokens) ? totalTokens : 0,
  };
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
 * @returns {Promise<{ images: Array<{ type: string, data: string }>, usage: object, raw?: object }>} 返回 OpenAI 格式归一化后的图片与 token 统计
 */
export async function generateImage(model, params) {
  try {
    const request = buildImageRequest(model, params);
    const res = await fetch(request.url, {
      method: "POST",
      headers: request.headers,
      body: request.isFormData ? request.body : JSON.stringify(request.body),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const message = data?.error?.message || data?.message || `${res.status} ${res.statusText}`;
      return { images: [{ type: "text", data: message }], usage: normalizeImageUsage(data?.usage), raw: data };
    }

    return normalizeImageGenerationData(data);
  } catch (err) {
    return { images: [{ type: "text", data: String(err) }], usage: normalizeImageUsage() };
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
