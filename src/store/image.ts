import { cloneCreationRuntime, createCreationRuntime } from "./creation-runtime";
import type { ImageConversationInfo, ImageConversationMessage, ImageDataItem } from "@/types";
import type { CreationRuntime } from "./creation-runtime";

export const ImageState = {
  imageList: [] as ImageDataItem[],
  imageConversationList: [] as ImageConversationInfo[],
  curImageConversationId: "",
  imageMessages: [] as ImageConversationMessage[],
  imageRuntime: createCreationRuntime(),
  imageMessagesById: {} as Record<string, ImageConversationMessage[]>,
  imageRuntimeById: {} as Record<string, CreationRuntime>,
  imageLoadedById: {} as Record<string, boolean>,

  _ensureImageEntry(iid) {
    if (!iid) return;
    if (!this.imageMessagesById[iid]) this.imageMessagesById[iid] = [];
    if (!this.imageRuntimeById[iid]) this.imageRuntimeById[iid] = createCreationRuntime();
    if (!this.imageLoadedById[iid]) this.imageLoadedById[iid] = false;
  },

  _syncActiveImageState() {
    const iid = this.curImageConversationId;
    if (!iid) {
      this.imageMessages = [];
      this.imageRuntime = createCreationRuntime();
      return;
    }

    this._ensureImageEntry(iid);
    if (this.imageRuntimeById[iid]?.completedNotice) {
      this.imageRuntimeById[iid] = cloneCreationRuntime({
        ...this.imageRuntimeById[iid],
        completedNotice: false,
      });
    }
    this.imageMessages = this.imageMessagesById[iid] || [];
    this.imageRuntime = cloneCreationRuntime(this.imageRuntimeById[iid]);
  },

  resetImageList(t) {
    this.imageList = [...t];
  },

  pushImage(t) {
    this.imageList.splice(0, 0, t);
  },

  deleteImage(id) {
    const index = this.imageList.findIndex((t) => t.id == id);
    if (index >= 0) {
      this.imageList.splice(index, 1);
    }
  },

  resetImageConversationList(items = []) {
    this.imageConversationList = [...items];
  },

  pushImageConversation(item) {
    const index = this.imageConversationList.findIndex((conversation) => conversation.iid === item?.iid);
    if (index >= 0) {
      this.imageConversationList.splice(index, 1, { ...this.imageConversationList[index], ...item });
      return;
    }
    this.imageConversationList.push(item);
    this._ensureImageEntry(item?.iid);
  },

  deleteImageConversation(id) {
    this.imageConversationList = this.imageConversationList.filter((item) => item.iid !== id);
    delete this.imageMessagesById[id];
    delete this.imageRuntimeById[id];
    delete this.imageLoadedById[id];
    if (this.curImageConversationId === id) {
      this.curImageConversationId = "";
      this._syncActiveImageState();
    }
  },

  setCurImageConversationId(id = "") {
    this.curImageConversationId = id;
    this._syncActiveImageState();
  },

  resetImageMessages(data: any = []) {
    const iid = Array.isArray(data) ? this.curImageConversationId : data?.iid || this.curImageConversationId;
    const messages = Array.isArray(data) ? data : data?.messages || [];

    if (!iid) {
      this.imageMessages = [...messages];
      return;
    }

    this._ensureImageEntry(iid);
    this.imageMessagesById[iid] = [...messages];
    this.imageLoadedById[iid] = true;

    this.imageRuntimeById[iid] = cloneCreationRuntime(this.imageRuntimeById[iid]);

    if (iid === this.curImageConversationId) this._syncActiveImageState();
  },

  pushImageMessage(data) {
    const iid = data?.iid || this.curImageConversationId;
    const message = data?.message || data;
    if (!iid || !message) return;

    this._ensureImageEntry(iid);
    this.imageMessagesById[iid].push(message);
    this.imageLoadedById[iid] = true;

    if (iid === this.curImageConversationId) {
      this.imageMessages = this.imageMessagesById[iid];
    }
  },

  updateImageMessage(data) {
    const iid = data?.iid || this.curImageConversationId;
    const message = data?.message || data;
    if (!iid || !message) return;

    this._ensureImageEntry(iid);
    const messages = this.imageMessagesById[iid];
    const index = messages.findIndex((item) => item.id === message?.id);
    if (index >= 0) {
      messages.splice(index, 1, { ...messages[index], ...message });
    }

    if (iid === this.curImageConversationId) {
      this.imageMessages = messages;
    }
  },

  setImageRuntime(data: any = {}) {
    const iid = data?.iid || this.curImageConversationId;
    const runtime = data?.runtime || data;

    if (!iid) {
      this.imageRuntime = cloneCreationRuntime({
        ...this.imageRuntime,
        ...runtime,
      });
      return;
    }

    this._ensureImageEntry(iid);
    this.imageRuntimeById[iid] = cloneCreationRuntime({
      ...this.imageRuntimeById[iid],
      ...runtime,
    });

    if (iid === this.curImageConversationId) {
      this.imageRuntime = cloneCreationRuntime(this.imageRuntimeById[iid]);
    }
  },

  resetImageRuntime(data: any = {}) {
    const iid = typeof data === "string" ? data : data?.iid || this.curImageConversationId;

    if (!iid) {
      this.imageRuntime = createCreationRuntime();
      return;
    }

    this._ensureImageEntry(iid);
    this.imageRuntimeById[iid] = createCreationRuntime();

    if (iid === this.curImageConversationId) {
      this.imageRuntime = cloneCreationRuntime(this.imageRuntimeById[iid]);
    }
  },
};
