export const ImageState = {
  /**
   *  @type {T_ImageDataItem[]}
   */
  imageList: [],

  /**
   *  @type {import("@/types").ImageConversationInfo[]}
   */
  imageConversationList: [],

  /**
   * Current image conversation id.
   */
  curImageConversationId: "",

  /**
   *  @type {import("@/types").ImageConversationMessage[]}
   */
  imageMessages: [],

  /**
   *  @type {{ pending: boolean, status: string, startedAt: number, elapsedMs: number }}
   */
  imageRuntime: {
    pending: false,
    status: "idle",
    startedAt: 0,
    elapsedMs: 0,
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
  },

  deleteImageConversation(id) {
    this.imageConversationList = this.imageConversationList.filter((item) => item.iid !== id);
    if (this.curImageConversationId === id) {
      this.curImageConversationId = "";
      this.imageMessages = [];
    }
  },

  setCurImageConversationId(id = "") {
    this.curImageConversationId = id;
  },

  resetImageMessages(messages = []) {
    this.imageMessages = [...messages];
  },

  pushImageMessage(message) {
    this.imageMessages.push(message);
  },

  updateImageMessage(message) {
    const index = this.imageMessages.findIndex((item) => item.id === message?.id);
    if (index >= 0) {
      this.imageMessages.splice(index, 1, { ...this.imageMessages[index], ...message });
    }
  },

  setImageRuntime(runtime = {}) {
    this.imageRuntime = { ...this.imageRuntime, ...runtime };
  },

  resetImageRuntime() {
    this.imageRuntime = {
      pending: false,
      status: "idle",
      startedAt: 0,
      elapsedMs: 0,
    };
  },
};
