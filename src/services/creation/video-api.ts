import { apiRequest } from "@/services";
import type { ApiResponse, VideoConversationListItem, VideoDataItem } from "@/types";

export const getVideoListAPI = (): Promise<ApiResponse<VideoDataItem[]>> => apiRequest("post", "/_api/video/getVideoList", {});

export const pushVideoAPI = (id: string, prompt: string, url: string): Promise<ApiResponse<VideoDataItem>> =>
  apiRequest("post", "/_api/video/pushVideo", { video_id: id, video_prompt: prompt, video_url: url });

export const deleteVideoAPI = (id: string): Promise<ApiResponse<null>> => apiRequest("post", "/_api/video/deleteVideo", { video_id: id });

export const getVideoConversationListAPI = (): Promise<ApiResponse<VideoConversationListItem[]>> => apiRequest("post", "/_api/video/getConversationList", {});

export const addVideoConversationAPI = (vid: string, vname: string): Promise<ApiResponse<null>> =>
  apiRequest("post", "/_api/video/addConversation", { vid, vname });

export const deleteVideoConversationAPI = (vid: string): Promise<ApiResponse<null>> => apiRequest("post", "/_api/video/deleteConversation", { vid });

export const getVideoConversationMessagesAPI = (vid: string): Promise<ApiResponse<string>> =>
  apiRequest("post", "/_api/video/getConversationMessages", { vid });

export const setVideoConversationMessagesAPI = (vid: string, messages: unknown[]): Promise<ApiResponse<null>> =>
  apiRequest("post", "/_api/video/setConversationMessages", { vid, messages: JSON.stringify(messages) });
