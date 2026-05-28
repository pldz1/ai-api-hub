function createImageRuntime() {
  return {
    pending: false,
    status: "idle",
    completedNotice: false,
    startedAt: 0,
    elapsedMs: 0,
    error: "",
  };
}

function cloneImageRuntime(runtime = {}) {
  return {
    ...createImageRuntime(),
    ...runtime,
  };
}

function getRuntimeStatusByMessages(messages = []) {
  return messages.length > 0 ? "success" : "idle";
}

export const ImageState = {
  imageList: [],
  imageConversationList: [],
  curImageConversationId: "",
  imageMessages: [],
  imageRuntime: createImageRuntime(),
  imageMessagesById: {},
  imageRuntimeById: {},
  imageLoadedById: {},

  _ensureImageEntry(iid) {
    if (!iid) return;
    if (!this.imageMessagesById[iid]) this.imageMessagesById[iid] = [];
    if (!this.imageRuntimeById[iid]) this.imageRuntimeById[iid] = createImageRuntime();
    if (!this.imageLoadedById[iid]) this.imageLoadedById[iid] = false;
  },

  _syncActiveImageState() {
    const iid = this.curImageConversationId;
    if (!iid) {
      this.imageMessages = [];
      this.imageRuntime = createImageRuntime();
      return;
    }

    this._ensureImageEntry(iid);
    if (this.imageRuntimeById[iid]?.completedNotice) {
      this.imageRuntimeById[iid] = cloneImageRuntime({
        ...this.imageRuntimeById[iid],
        completedNotice: false,
      });
    }
    this.imageMessages = this.imageMessagesById[iid] || [];
    this.imageRuntime = cloneImageRuntime(this.imageRuntimeById[iid]);
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

    const currentRuntime = this.imageRuntimeById[iid] || createImageRuntime();
    if (!currentRuntime.pending) {
      currentRuntime.status = getRuntimeStatusByMessages(this.imageMessagesById[iid]);
    }
    this.imageRuntimeById[iid] = cloneImageRuntime(currentRuntime);

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
      this.imageRuntime = cloneImageRuntime({
        ...this.imageRuntime,
        ...runtime,
      });
      return;
    }

    this._ensureImageEntry(iid);
    this.imageRuntimeById[iid] = cloneImageRuntime({
      ...this.imageRuntimeById[iid],
      ...runtime,
    });

    if (iid === this.curImageConversationId) {
      this.imageRuntime = cloneImageRuntime(this.imageRuntimeById[iid]);
    }
  },

  resetImageRuntime(data: any = {}) {
    const iid = typeof data === "string" ? data : data?.iid || this.curImageConversationId;

    if (!iid) {
      this.imageRuntime = createImageRuntime();
      return;
    }

    this._ensureImageEntry(iid);
    this.imageRuntimeById[iid] = {
      ...createImageRuntime(),
      status: getRuntimeStatusByMessages(this.imageMessagesById[iid] || []),
    };

    if (iid === this.curImageConversationId) {
      this.imageRuntime = cloneImageRuntime(this.imageRuntimeById[iid]);
    }
  },
};
