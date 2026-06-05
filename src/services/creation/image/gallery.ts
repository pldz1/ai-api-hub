import store from "@/store";
import { tr } from "@/i18n";
import { dsAlert, getUuid } from "@/utils";
import { deleteImageAPI, getImageListAPI, pushImageAPI } from "./api";

export async function getImageList(): Promise<boolean> {
  const res = await getImageListAPI();
  if (!res.flag) {
    await store.dispatch("resetImageList", []);
    console.error("Failed to fetch image list:", res.log);
    dsAlert({ type: "error", message: tr("toast.imageListFetchFailed", { error: res.log }) });
    return false;
  }

  if (!Array.isArray(res.data)) {
    await store.dispatch("resetImageList", []);
    console.error("Invalid image list received:", res.data);
    dsAlert({
      type: "error",
      message: tr("toast.imageListInvalid"),
    });
    return false;
  }

  const reversed = res.data.slice().reverse();
  await store.dispatch("resetImageList", reversed);
  return true;
}

export async function pushImage(prompt: string, url: string): Promise<boolean> {
  const id = getUuid("img");
  const res = await pushImageAPI(id, prompt, url);
  if (!res.flag) {
    console.error("Failed to push image:", res.log);
    dsAlert({
      type: "error",
      message: tr("toast.imagePushFailed", { error: res.log }),
    });
    return false;
  }

  await store.dispatch("pushImage", res.data?.id ? res.data : { id, prompt, src: url });
  return true;
}

export async function deleteImage(id: string): Promise<boolean> {
  const res = await deleteImageAPI(id);
  if (!res.flag) {
    console.error("Failed to delete image:", res.log);
    dsAlert({
      type: "error",
      message: tr("toast.imageDeleteFailed", { error: res.log }),
    });
    return false;
  }

  await store.dispatch("deleteImage", id);
  return true;
}
