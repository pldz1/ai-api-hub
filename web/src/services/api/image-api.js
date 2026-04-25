import store from "@/store";
import { apiRequest } from "./axios-request.js";
import { dsAlert, getUuid } from "@/utils";
import { tr } from "@/i18n";

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
