import store from "@/store";
import { getUuid } from "@/utils";
import { getImageSource, getVideoSource, imageRepository, setImageSource, setVideoSource, videoRepository } from "@/persistence";
import type { ImageConversationMessage, ImageInputAttachment, ImagePayload, VideoConversationMessage, VideoInputAttachment, VideoPayload } from "@/types";

const ARCHIVE_FORMAT = "ai-api-hub.conversation";
const ARCHIVE_VERSION = 2;
const IDB_SRC_PREFIX = "idb:";

interface CreationConversationArchive<TType extends "image" | "video", TMessage> {
  format: typeof ARCHIVE_FORMAT;
  version: typeof ARCHIVE_VERSION;
  type: TType;
  exportedAt: string;
  conversation: {
    id: string;
    name: string;
  };
  messages: TMessage[];
}

type ImageConversationArchive = CreationConversationArchive<"image", ImageConversationMessage>;
type VideoConversationArchive = CreationConversationArchive<"video", VideoConversationMessage>;

function safeFilename(value: string, fallback: string): string {
  const name = value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ");
  return (name || fallback).slice(0, 80);
}

function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function readJsonFile(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result || "{}")));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error || new Error("Failed to read file."));
    reader.readAsText(file);
  });
}

function assertCreationArchive<TType extends "image" | "video">(
  value: unknown,
  type: TType,
): asserts value is TType extends "image" ? ImageConversationArchive : VideoConversationArchive {
  const archive = value as Partial<CreationConversationArchive<TType, unknown>>;
  if (
    !archive ||
    archive.format !== ARCHIVE_FORMAT ||
    archive.version !== ARCHIVE_VERSION ||
    archive.type !== type ||
    !archive.conversation ||
    !Array.isArray(archive.messages)
  ) {
    throw new Error(`Invalid ${type} conversation archive.`);
  }
}

async function expandImageSrc(src = ""): Promise<string> {
  if (!src.startsWith(IDB_SRC_PREFIX)) return src;
  return (await getImageSource(src.slice(IDB_SRC_PREFIX.length))) || src;
}

async function expandVideoSrc(src = ""): Promise<string> {
  if (!src.startsWith(IDB_SRC_PREFIX)) return src;
  return (await getVideoSource(src.slice(IDB_SRC_PREFIX.length))) || src;
}

async function expandImageMessages(messages: ImageConversationMessage[]): Promise<ImageConversationMessage[]> {
  return Promise.all(
    messages.map(async (message) => ({
      ...message,
      images: await Promise.all((message.images || []).map(async (image) => ({ ...image, src: await expandImageSrc(image.src) }))),
      attachments: await Promise.all(
        (message.attachments || []).map(async (attachment) => ({ ...attachment, previewUrl: await expandImageSrc(attachment.previewUrl) })),
      ),
    })),
  );
}

async function expandVideoMessages(messages: VideoConversationMessage[]): Promise<VideoConversationMessage[]> {
  return Promise.all(
    messages.map(async (message) => ({
      ...message,
      videos: await Promise.all((message.videos || []).map(async (video) => ({ ...video, src: await expandVideoSrc(video.src) }))),
      attachments: await Promise.all(
        (message.attachments || []).map(async (attachment) => ({ ...attachment, previewUrl: await expandVideoSrc(attachment.previewUrl) })),
      ),
    })),
  );
}

async function importImagePayload(image: ImagePayload): Promise<ImagePayload> {
  const src = image.src || "";
  if (!src.startsWith("data:")) return image;
  const id = getUuid("imgout");
  await setImageSource(id, src);
  return { ...image, id, src: `${IDB_SRC_PREFIX}${id}` };
}

async function importImageAttachment(attachment: ImageInputAttachment): Promise<ImageInputAttachment> {
  const id = getUuid("imgatt");
  const previewUrl = attachment.previewUrl || "";
  if (previewUrl.startsWith("data:")) {
    await setImageSource(`${id}-preview`, previewUrl);
  }
  return {
    ...attachment,
    id,
    data: "",
    previewUrl: previewUrl.startsWith("data:") ? `${IDB_SRC_PREFIX}${id}-preview` : previewUrl,
  };
}

async function importVideoPayload(video: VideoPayload): Promise<VideoPayload> {
  const src = video.src || "";
  if (!src.startsWith("data:")) return video;
  const id = getUuid("vidout");
  await setVideoSource(id, src);
  return { ...video, id, src: `${IDB_SRC_PREFIX}${id}` };
}

async function importVideoAttachment(attachment: VideoInputAttachment): Promise<VideoInputAttachment> {
  const id = getUuid("vidatt");
  const previewUrl = attachment.previewUrl || "";
  if (previewUrl.startsWith("data:")) {
    await setVideoSource(`${id}-preview`, previewUrl);
  }
  return {
    ...attachment,
    id,
    data: "",
    previewUrl: previewUrl.startsWith("data:") ? `${IDB_SRC_PREFIX}${id}-preview` : previewUrl,
  };
}

async function foldImportedImageMessages(messages: ImageConversationMessage[]): Promise<ImageConversationMessage[]> {
  return Promise.all(
    messages.map(async (message) => ({
      ...message,
      id: getUuid("imgmsg"),
      images: await Promise.all((message.images || []).map(importImagePayload)),
      attachments: await Promise.all((message.attachments || []).map(importImageAttachment)),
    })),
  );
}

async function foldImportedVideoMessages(messages: VideoConversationMessage[]): Promise<VideoConversationMessage[]> {
  return Promise.all(
    messages.map(async (message) => ({
      ...message,
      id: getUuid("vidmsg"),
      videos: await Promise.all((message.videos || []).map(importVideoPayload)),
      attachments: await Promise.all((message.attachments || []).map(importVideoAttachment)),
    })),
  );
}

export async function exportImageConversationArchive(iid: string): Promise<void> {
  const item = store.state.imageConversationList.find((conversation: { iid: string }) => conversation.iid === iid);
  if (!iid || !item) throw new Error("Image conversation not found.");

  const archive: ImageConversationArchive = {
    format: ARCHIVE_FORMAT,
    version: ARCHIVE_VERSION,
    type: "image",
    exportedAt: new Date().toISOString(),
    conversation: {
      id: iid,
      name: item.iname || iid,
    },
    messages: await expandImageMessages(await imageRepository.getMessages(iid)),
  };

  downloadJson(archive, `${safeFilename(archive.conversation.name, "image")}.aihub-image.json`);
}

export async function importImageConversationArchive(file: File): Promise<string> {
  const raw = await readJsonFile(file);
  assertCreationArchive(raw, "image");

  const iid = getUuid("imgconv");
  const iname = raw.conversation.name || "Imported image";
  const importedMessages = await foldImportedImageMessages(raw.messages);
  await imageRepository.createConversation(iid, iname, importedMessages);
  const messages = await imageRepository.getMessages(iid);

  store.commit("pushImageConversation", { iid, iname });
  store.commit("resetImageMessages", { iid, messages });
  return iid;
}

export async function exportVideoConversationArchive(vid: string): Promise<void> {
  const item = store.state.videoConversationList.find((conversation: { vid: string }) => conversation.vid === vid);
  if (!vid || !item) throw new Error("Video conversation not found.");

  const archive: VideoConversationArchive = {
    format: ARCHIVE_FORMAT,
    version: ARCHIVE_VERSION,
    type: "video",
    exportedAt: new Date().toISOString(),
    conversation: {
      id: vid,
      name: item.vname || vid,
    },
    messages: await expandVideoMessages(await videoRepository.getMessages(vid)),
  };

  downloadJson(archive, `${safeFilename(archive.conversation.name, "video")}.aihub-video.json`);
}

export async function importVideoConversationArchive(file: File): Promise<string> {
  const raw = await readJsonFile(file);
  assertCreationArchive(raw, "video");

  const vid = getUuid("vidconv");
  const vname = raw.conversation.name || "Imported video";
  const importedMessages = await foldImportedVideoMessages(raw.messages);
  await videoRepository.createConversation(vid, vname, importedMessages);
  const messages = await videoRepository.getMessages(vid);

  store.commit("pushVideoConversation", { vid, vname });
  store.commit("resetVideoMessages", { vid, messages });
  return vid;
}
