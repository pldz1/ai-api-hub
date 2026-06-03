import type { VideoConversationInfo, VideoConversationListItem, VideoConversationMessage, VideoDataItem, VideoMessageStatus } from "@/types";

export interface VideoRuntime {
  pending: boolean;
  status: VideoMessageStatus | "idle";
  completedNotice: boolean;
  startedAt: number;
  elapsedMs: number;
  error: string;
}

function _defaultVideoRuntime(): VideoRuntime {
  return { pending: false, status: "idle", completedNotice: false, startedAt: 0, elapsedMs: 0, error: "" };
}

export const VideoState = {
  videoList: [] as VideoDataItem[],
  videoConversationList: [] as VideoConversationInfo[],
  curVideoConversationId: "",
  videoMessages: [] as VideoConversationMessage[],
  videoRuntime: _defaultVideoRuntime(),
  videoMessagesById: {} as Record<string, VideoConversationMessage[]>,
  videoRuntimeById: {} as Record<string, VideoRuntime>,
  videoLoadedById: {} as Record<string, boolean>,

  _ensureVideoEntry(vid: string) {
    if (!this.videoMessagesById[vid]) this.videoMessagesById[vid] = [];
    if (!this.videoRuntimeById[vid]) this.videoRuntimeById[vid] = _defaultVideoRuntime();
    if (this.videoLoadedById[vid] === undefined) this.videoLoadedById[vid] = false;
  },

  _syncActiveVideoState() {
    const { curVideoConversationId: vid } = this;
    this._ensureVideoEntry(vid);
    if (vid && this.videoRuntimeById[vid]) {
      this.videoRuntimeById[vid].completedNotice = false;
    }
    this.videoMessages = vid ? this.videoMessagesById[vid] || [] : [];
    this.videoRuntime = vid ? this.videoRuntimeById[vid] || _defaultVideoRuntime() : _defaultVideoRuntime();
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
    const runtime = this.videoRuntimeById[vid];
    if (runtime) {
      runtime.status = messages.length > 0 ? "success" : "idle";
    }
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

  setVideoRuntime(data: { vid: string; runtime: Partial<VideoRuntime> }) {
    const { vid, runtime } = data;
    this._ensureVideoEntry(vid);
    Object.assign(this.videoRuntimeById[vid], runtime);
    if (vid === this.curVideoConversationId) {
      this._syncActiveVideoState();
    }
  },

  resetVideoRuntime(vid: string) {
    this._ensureVideoEntry(vid);
    this.videoRuntimeById[vid] = _defaultVideoRuntime();
    if (vid === this.curVideoConversationId) {
      this._syncActiveVideoState();
    }
  },
};
