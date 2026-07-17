import type { ImageConversationListItem, ImageConversationMessage, ImageDataItem } from "@/types";
import { deleteImageSource, getImageSource, setImageSource, urlToDataUrl } from "./blobs";
import { deleteImageMessageRecords, getImageMessageRecords, setImageMessageRecords } from "./records";
import { readBrowserWorkspace, updateBrowserWorkspace } from "./state";

const SOURCE_PREFIX = "idb:";

async function foldMessages(messages: ImageConversationMessage[]): Promise<ImageConversationMessage[]> {
  return Promise.all(
    messages.map(async (message) => ({
      ...message,
      images: await Promise.all(
        (message.images || []).map(async (image) => {
          if (!image.src?.startsWith("data:")) return image;
          await setImageSource(image.id, image.src);
          return { ...image, src: `${SOURCE_PREFIX}${image.id}` };
        }),
      ),
      attachments: await Promise.all(
        (message.attachments || []).map(async (attachment) => {
          const key = `${attachment.id}-preview`;
          if (attachment.previewUrl?.startsWith("data:")) await setImageSource(key, attachment.previewUrl);
          return {
            ...attachment,
            data: "",
            previewUrl: attachment.previewUrl?.startsWith("data:") ? `${SOURCE_PREFIX}${key}` : attachment.previewUrl,
          };
        }),
      ),
    })),
  );
}

async function expandSource(source = ""): Promise<string> {
  return source.startsWith(SOURCE_PREFIX) ? (await getImageSource(source.slice(SOURCE_PREFIX.length))) || source : source;
}

async function expandMessages(messages: ImageConversationMessage[]): Promise<ImageConversationMessage[]> {
  return Promise.all(
    messages.map(async (message) => ({
      ...message,
      images: await Promise.all((message.images || []).map(async (image) => ({ ...image, src: await expandSource(image.src) }))),
      attachments: await Promise.all(
        (message.attachments || []).map(async (attachment) => ({ ...attachment, previewUrl: await expandSource(attachment.previewUrl) })),
      ),
    })),
  );
}

async function cleanupMessages(messages: ImageConversationMessage[]): Promise<void> {
  await Promise.allSettled([
    ...messages.flatMap((message) => (message.images || []).map((image) => deleteImageSource(image.id))),
    ...messages.flatMap((message) => (message.attachments || []).map((attachment) => deleteImageSource(`${attachment.id}-preview`))),
  ]);
}

export const imageRepository = {
  async listAssets(): Promise<ImageDataItem[]> {
    const items = readBrowserWorkspace().images;
    return Promise.all(items.map(async (item) => ({ ...item, src: await getImageSource(item.id) })));
  },

  async saveAsset(id: string, prompt: string, source: string): Promise<ImageDataItem> {
    const src = await urlToDataUrl(source);
    await setImageSource(id, src);
    updateBrowserWorkspace((state) => {
      const item = { id, prompt };
      const index = state.images.findIndex((value) => value.id === id);
      if (index >= 0) state.images[index] = item;
      else state.images.push(item);
    });
    return { id, prompt, src };
  },

  async deleteAsset(id: string): Promise<void> {
    await deleteImageSource(id);
    updateBrowserWorkspace((state) => {
      state.images = state.images.filter((item) => item.id !== id);
    });
  },

  listConversations(): ImageConversationListItem[] {
    return readBrowserWorkspace().imageConversations.map(({ iid, iname }) => ({ iid, iname }));
  },

  async createConversation(iid: string, iname: string, messages: ImageConversationMessage[] = []): Promise<void> {
    if (readBrowserWorkspace().imageConversations.some((item) => item.iid === iid)) {
      throw new Error(`Image conversation already exists: ${iid}`);
    }
    await setImageMessageRecords(iid, await foldMessages(messages));
    updateBrowserWorkspace((state) => {
      if (state.imageConversations.some((item) => item.iid === iid)) throw new Error(`Image conversation already exists: ${iid}`);
      state.imageConversations.push({ iid, iname });
    });
  },

  async getMessages(iid: string): Promise<ImageConversationMessage[]> {
    const conversation = readBrowserWorkspace().imageConversations.find((item) => item.iid === iid);
    if (!conversation) throw new Error(`Image conversation not found: ${iid}`);
    return expandMessages(await getImageMessageRecords(iid));
  },

  async saveMessages(iid: string, messages: ImageConversationMessage[]): Promise<void> {
    const folded = await foldMessages(messages);
    if (!readBrowserWorkspace().imageConversations.some((item) => item.iid === iid)) throw new Error(`Image conversation not found: ${iid}`);
    await setImageMessageRecords(iid, folded);
  },

  async deleteConversation(iid: string): Promise<void> {
    const conversation = readBrowserWorkspace().imageConversations.find((item) => item.iid === iid);
    if (!conversation) return;
    const messages = await getImageMessageRecords(iid);
    await cleanupMessages(messages);
    updateBrowserWorkspace((state) => {
      state.imageConversations = state.imageConversations.filter((item) => item.iid !== iid);
    });
    await deleteImageMessageRecords(iid);
  },
};
