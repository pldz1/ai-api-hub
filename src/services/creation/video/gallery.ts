import store from "@/store";
import { tr } from "@/i18n";
import { dsAlert, getUuid } from "@/utils";
import { deleteVideoAPI, getVideoListAPI, pushVideoAPI } from "./api";

export async function getVideoList(): Promise<boolean> {
  const res = await getVideoListAPI();
  if (!res.flag) {
    await store.dispatch("resetVideoList", []);
    console.error("Failed to fetch video list:", res.log);
    dsAlert({ type: "error", message: tr("toast.videoListFetchFailed", { error: res.log }) });
    return false;
  }

  if (!Array.isArray(res.data)) {
    await store.dispatch("resetVideoList", []);
    return false;
  }

  const reversed = res.data.slice().reverse();
  await store.dispatch("resetVideoList", reversed);
  return true;
}

export async function pushVideo(prompt: string, url: string): Promise<boolean> {
  const id = getUuid("vid");
  const res = await pushVideoAPI(id, prompt, url);
  if (!res.flag) {
    console.error("Failed to push video:", res.log);
    dsAlert({ type: "error", message: tr("toast.videoPushFailed", { error: res.log }) });
    return false;
  }

  await store.dispatch("pushVideo", res.data?.id ? res.data : { id, prompt, src: url });
  return true;
}

export async function deleteVideo(id: string): Promise<boolean> {
  const res = await deleteVideoAPI(id);
  if (!res.flag) {
    console.error("Failed to delete video:", res.log);
    dsAlert({ type: "error", message: tr("toast.videoDeleteFailed", { error: res.log }) });
    return false;
  }

  await store.dispatch("deleteVideo", id);
  return true;
}
