import store from "@/store";
import { tr } from "@/i18n";
import { imageRepository } from "@/persistence";
import { dsAlert, getUuid } from "@/utils";

export async function getImageList(): Promise<boolean> {
  try {
    const items = await imageRepository.listAssets();
    store.commit("resetImageList", items.slice().reverse());
    return true;
  } catch (error) {
    store.commit("resetImageList", []);
    console.error("Failed to load image list:", error);
    dsAlert({ type: "error", message: tr("toast.imageListFetchFailed", { error: error instanceof Error ? error.message : String(error) }) });
    return false;
  }
}

export async function pushImage(prompt: string, url: string): Promise<boolean> {
  const id = getUuid("img");
  try {
    const image = await imageRepository.saveAsset(id, prompt, url);
    store.commit("pushImage", image);
    return true;
  } catch (error) {
    console.error("Failed to save image:", error);
    dsAlert({
      type: "error",
      message: tr("toast.imagePushFailed", { error: error instanceof Error ? error.message : String(error) }),
    });
    return false;
  }
}

export async function deleteImage(id: string): Promise<boolean> {
  try {
    await imageRepository.deleteAsset(id);
    store.commit("deleteImage", id);
    return true;
  } catch (error) {
    console.error("Failed to delete image:", error);
    dsAlert({
      type: "error",
      message: tr("toast.imageDeleteFailed", { error: error instanceof Error ? error.message : String(error) }),
    });
    return false;
  }
}
