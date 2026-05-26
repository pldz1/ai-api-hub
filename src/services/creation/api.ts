import { apiRequest } from "@/services/app";
import type { ApiResponse, ImageConversationListItem, ImageDataItem } from "@/services/types";
import type { ImageConversationMessage } from "@/types";

export const getImageListAPI = (): Promise<ApiResponse<ImageDataItem[]>> => apiRequest("post", "/_api/image/getImageList", {});

export const pushImageAPI = (id: string, prompt: string, url: string): Promise<ApiResponse<ImageDataItem>> =>
  apiRequest("post", "/_api/image/pushImage", {
    image_id: id,
    image_prompt: prompt,
    image_url: url,
  });

export const deleteImageAPI = (id: string): Promise<ApiResponse<null>> =>
  apiRequest("post", "/_api/image/deleteImage", {
    image_id: id,
  });

export const getImageConversationListAPI = (): Promise<ApiResponse<ImageConversationListItem[]>> => apiRequest("post", "/_api/image/getConversationList", {});

export const addImageConversationAPI = (iid: string, iname: string): Promise<ApiResponse<null>> =>
  apiRequest("post", "/_api/image/addConversation", { iid, iname });

export const deleteImageConversationAPI = (iid: string): Promise<ApiResponse<null>> => apiRequest("post", "/_api/image/deleteConversation", { iid });

export const getImageConversationMessagesAPI = (iid: string): Promise<ApiResponse<string>> => apiRequest("post", "/_api/image/getConversationMessages", { iid });

export const setImageConversationMessagesAPI = (iid: string, messages: ImageConversationMessage[]): Promise<ApiResponse<null>> =>
  apiRequest("post", "/_api/image/setConversationMessages", {
    iid,
    messages: JSON.stringify(messages),
  });
