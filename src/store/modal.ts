import type { ChatMessageAttachment } from "@/types";

export const ModalState = {
  /**
   * 预览图像的 base64 的数据
   * @type {string}
   */
  modalImgSrc: "",

  /**
   * 预览聊天附件内容
   * @type {ChatMessageAttachment | null}
   */
  modalChatAttachment: null as ChatMessageAttachment | null,

  /**
   * 设置要显示的图像
   * @param {string} t 目标的图像.
   */
  setModalImage(t) {
    this.modalImgSrc = t;
  },

  /**
   * 设置要显示的聊天附件
   * @param {ChatMessageAttachment | null} attachment
   */
  setModalChatAttachment(attachment: ChatMessageAttachment | null) {
    this.modalChatAttachment = attachment;
  },
};
