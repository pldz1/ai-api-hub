import store from "@/store";
import { tr } from "@/i18n";
import { videoRepository } from "@/persistence";
import { dsAlert, getUuid } from "@/utils";

export async function getVideoList(): Promise<boolean> {
  try {
    const items = await videoRepository.listAssets();
    store.commit("resetVideoList", items.slice().reverse());
    return true;
  } catch (error) {
    store.commit("resetVideoList", []);
    console.error("Failed to load video list:", error);
    dsAlert({ type: "error", message: tr("toast.videoListFetchFailed", { error: error instanceof Error ? error.message : String(error) }) });
    return false;
  }
}

export async function pushVideo(prompt: string, url: string): Promise<boolean> {
  const id = getUuid("vid");
  try {
    const video = await videoRepository.saveAsset(id, prompt, url);
    store.commit("pushVideo", video);
    return true;
  } catch (error) {
    console.error("Failed to save video:", error);
    dsAlert({ type: "error", message: tr("toast.videoPushFailed", { error: error instanceof Error ? error.message : String(error) }) });
    return false;
  }
}

export async function deleteVideo(id: string): Promise<boolean> {
  try {
    await videoRepository.deleteAsset(id);
    store.commit("deleteVideo", id);
    return true;
  } catch (error) {
    console.error("Failed to delete video:", error);
    dsAlert({ type: "error", message: tr("toast.videoDeleteFailed", { error: error instanceof Error ? error.message : String(error) }) });
    return false;
  }
}
