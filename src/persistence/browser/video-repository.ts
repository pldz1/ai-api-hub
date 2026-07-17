import type { VideoConversationListItem, VideoConversationMessage, VideoDataItem } from "@/types";
import { deleteVideoSource, getVideoSource, setVideoSource, urlToDataUrl } from "./blobs";
import { deleteVideoMessageRecords, getVideoMessageRecords, setVideoMessageRecords } from "./records";
import { readBrowserWorkspace, updateBrowserWorkspace } from "./state";

const SOURCE_PREFIX = "idb:";

async function foldMessages(messages: VideoConversationMessage[]): Promise<VideoConversationMessage[]> {
  return Promise.all(
    messages.map(async (message) => ({
      ...message,
      videos: await Promise.all(
        (message.videos || []).map(async (video) => {
          if (!video.src?.startsWith("data:")) return video;
          await setVideoSource(video.id, video.src);
          return { ...video, src: `${SOURCE_PREFIX}${video.id}` };
        }),
      ),
      attachments: await Promise.all(
        (message.attachments || []).map(async (attachment) => {
          const key = `${attachment.id}-preview`;
          if (attachment.previewUrl?.startsWith("data:")) await setVideoSource(key, attachment.previewUrl);
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
  return source.startsWith(SOURCE_PREFIX) ? (await getVideoSource(source.slice(SOURCE_PREFIX.length))) || source : source;
}

async function expandMessages(messages: VideoConversationMessage[]): Promise<VideoConversationMessage[]> {
  return Promise.all(
    messages.map(async (message) => ({
      ...message,
      videos: await Promise.all((message.videos || []).map(async (video) => ({ ...video, src: await expandSource(video.src) }))),
      attachments: await Promise.all(
        (message.attachments || []).map(async (attachment) => ({ ...attachment, previewUrl: await expandSource(attachment.previewUrl) })),
      ),
    })),
  );
}

async function cleanupMessages(messages: VideoConversationMessage[]): Promise<void> {
  await Promise.allSettled([
    ...messages.flatMap((message) => (message.videos || []).map((video) => deleteVideoSource(video.id))),
    ...messages.flatMap((message) => (message.attachments || []).map((attachment) => deleteVideoSource(`${attachment.id}-preview`))),
  ]);
}

export const videoRepository = {
  async listAssets(): Promise<VideoDataItem[]> {
    const items = readBrowserWorkspace().videos;
    return Promise.all(items.map(async (item) => ({ ...item, src: await getVideoSource(item.id) })));
  },

  async saveAsset(id: string, prompt: string, source: string): Promise<VideoDataItem> {
    const src = await urlToDataUrl(source);
    await setVideoSource(id, src);
    updateBrowserWorkspace((state) => {
      const item = { id, prompt };
      const index = state.videos.findIndex((value) => value.id === id);
      if (index >= 0) state.videos[index] = item;
      else state.videos.push(item);
    });
    return { id, prompt, src };
  },

  async deleteAsset(id: string): Promise<void> {
    await deleteVideoSource(id);
    updateBrowserWorkspace((state) => {
      state.videos = state.videos.filter((item) => item.id !== id);
    });
  },

  listConversations(): VideoConversationListItem[] {
    return readBrowserWorkspace().videoConversations.map(({ vid, vname }) => ({ vid, vname }));
  },

  async createConversation(vid: string, vname: string, messages: VideoConversationMessage[] = []): Promise<void> {
    if (readBrowserWorkspace().videoConversations.some((item) => item.vid === vid)) {
      throw new Error(`Video conversation already exists: ${vid}`);
    }
    await setVideoMessageRecords(vid, await foldMessages(messages));
    updateBrowserWorkspace((state) => {
      if (state.videoConversations.some((item) => item.vid === vid)) throw new Error(`Video conversation already exists: ${vid}`);
      state.videoConversations.push({ vid, vname });
    });
  },

  async getMessages(vid: string): Promise<VideoConversationMessage[]> {
    const conversation = readBrowserWorkspace().videoConversations.find((item) => item.vid === vid);
    if (!conversation) throw new Error(`Video conversation not found: ${vid}`);
    return expandMessages(await getVideoMessageRecords(vid));
  },

  async saveMessages(vid: string, messages: VideoConversationMessage[]): Promise<void> {
    const folded = await foldMessages(messages);
    if (!readBrowserWorkspace().videoConversations.some((item) => item.vid === vid)) throw new Error(`Video conversation not found: ${vid}`);
    await setVideoMessageRecords(vid, folded);
  },

  async deleteConversation(vid: string): Promise<void> {
    const conversation = readBrowserWorkspace().videoConversations.find((item) => item.vid === vid);
    if (!conversation) return;
    const messages = await getVideoMessageRecords(vid);
    await cleanupMessages(messages);
    updateBrowserWorkspace((state) => {
      state.videoConversations = state.videoConversations.filter((item) => item.vid !== vid);
    });
    await deleteVideoMessageRecords(vid);
  },
};
