import type { VideoConversationInfo, VideoConversationListItem, VideoConversationMessage, VideoDataItem } from "@/types";
import { createCreationRuntime, type CreationRuntime } from "./creation-runtime";

export const VideoState = {
  videoList: [] as VideoDataItem[],
  videoConversationList: [] as VideoConversationInfo[],
  curVideoConversationId: "",
  videoMessages: [] as VideoConversationMessage[],
  videoRuntime: createCreationRuntime(),
  videoMessagesById: {} as Record<string, VideoConversationMessage[]>,
  videoRuntimeById: {} as Record<string, CreationRuntime>,
  videoLoadedById: {} as Record<string, boolean>,

  _ensureVideoEntry(vid: string) {
    if (!this.videoMessagesById[vid]) this.videoMessagesById[vid] = [];
    if (!this.videoRuntimeById[vid]) this.videoRuntimeById[vid] = createCreationRuntime();
    if (this.videoLoadedById[vid] === undefined) this.videoLoadedById[vid] = false;
  },

  _syncActiveVideoState() {
    const { curVideoConversationId: vid } = this;
    this._ensureVideoEntry(vid);
    if (vid && this.videoRuntimeById[vid]) {
      this.videoRuntimeById[vid].completedNotice = false;
    }
    this.videoMessages = vid ? this.videoMessagesById[vid] || [] : [];
    this.videoRuntime = vid ? this.videoRuntimeById[vid] || createCreationRuntime() : createCreationRuntime();
  },

  resetVideoList(list: VideoDataItem[] = []) {
    this.videoList = Array.isArray(list) ? list : [];
  },

  pushVideo(item: VideoDataItem) {
    if (item?.id) {
      this.videoList.unshift(item);
    }
  },

  deleteVideo(id: string) {
    this.videoList = this.videoList.filter((item) => item.id !== id);
  },

  resetVideoConversationList(list: VideoConversationListItem[] = []) {
    this.videoConversationList = Array.isArray(list) ? list : [];
  },

  pushVideoConversation(item: VideoConversationInfo) {
    if (item?.vid) {
      this.videoConversationList = this.videoConversationList.filter((i) => i.vid !== item.vid);
      this.videoConversationList.unshift(item);
      this._ensureVideoEntry(item.vid);
    }
  },

  deleteVideoConversation(vid: string) {
    this.videoConversationList = this.videoConversationList.filter((item) => item.vid !== vid);
    delete this.videoMessagesById[vid];
    delete this.videoRuntimeById[vid];
    delete this.videoLoadedById[vid];
    if (this.curVideoConversationId === vid) {
      this.curVideoConversationId = "";
      this._syncActiveVideoState();
    }
  },

  setCurVideoConversationId(vid: string) {
    this._ensureVideoEntry(vid);
    this.curVideoConversationId = vid;
    this._syncActiveVideoState();
  },

  resetVideoMessages(data: { vid: string; messages: VideoConversationMessage[] } | VideoConversationMessage[]) {
    let vid: string;
    let messages: VideoConversationMessage[];
    if (Array.isArray(data)) {
      vid = this.curVideoConversationId;
      messages = data;
    } else {
      vid = data.vid;
      messages = data.messages || [];
    }
    this._ensureVideoEntry(vid);
    this.videoMessagesById[vid] = messages;
    this.videoLoadedById[vid] = true;
    if (vid === this.curVideoConversationId) {
      this._syncActiveVideoState();
    }
  },

  pushVideoMessage(data: { vid: string; message: VideoConversationMessage }) {
    const { vid, message } = data;
    this._ensureVideoEntry(vid);
    this.videoMessagesById[vid] = [...(this.videoMessagesById[vid] || []), message];
    if (vid === this.curVideoConversationId) {
      this._syncActiveVideoState();
    }
  },

  updateVideoMessage(data: { vid: string; message: VideoConversationMessage }) {
    const { vid, message } = data;
    this._ensureVideoEntry(vid);
    const msgs = this.videoMessagesById[vid] || [];
    const idx = msgs.findIndex((m) => m.id === message.id);
    if (idx !== -1) {
      msgs[idx] = message;
    }
    if (vid === this.curVideoConversationId) {
      this._syncActiveVideoState();
    }
  },

  setVideoRuntime(data: { vid: string; runtime: Partial<CreationRuntime> }) {
    const { vid, runtime } = data;
    this._ensureVideoEntry(vid);
    Object.assign(this.videoRuntimeById[vid], runtime);
    if (vid === this.curVideoConversationId) {
      this._syncActiveVideoState();
    }
  },

  resetVideoRuntime(vid: string = this.curVideoConversationId) {
    if (!vid) {
      this.videoRuntime = createCreationRuntime();
      return;
    }
    this._ensureVideoEntry(vid);
    this.videoRuntimeById[vid] = createCreationRuntime();
    if (vid === this.curVideoConversationId) {
      this._syncActiveVideoState();
    }
  },
};
