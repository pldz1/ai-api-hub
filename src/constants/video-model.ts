import { videoParamList, videoProviderKeys, videoModelCatalog, videoModelTypeList } from "@/ai-capability/video";

function transformToPresetList(originalList: typeof videoParamList) {
  const descriptionMapping: Record<string, string> = {
    resolution: "video.resolutionTip",
    duration: "video.durationTip",
    prompt_extend: "video.promptExtendTip",
    watermark: "video.watermarkTip",
    first_frame: "video.firstFrameTip",
  };
  return originalList.map((item) => ({
    ...item,
    ...(item.key && descriptionMapping[item.key] ? { descriptionKey: descriptionMapping[item.key] } : {}),
  }));
}

export const videoParamPresetList = transformToPresetList(videoParamList);

export { videoProviderKeys as videoModelProviderList, videoProviderKeys, videoModelCatalog, videoModelTypeList };
