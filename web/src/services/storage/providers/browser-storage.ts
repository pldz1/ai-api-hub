const STORAGE_KEY = "chat-playground.browser-storage.v2";

const DEFAULT_STATE = {
  models: "",
  chatInsTemplateList: "",
  chats: [],
  images: [],
};

const DEFAULT_MODELS = {
  chat: [],
  imageGeneration: [],
  imageEdit: [],
  image: [],
  rtaudio: [],
};

function readState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? { ...DEFAULT_STATE, ...parsed } : { ...DEFAULT_STATE };
  } catch (error) {
    console.warn("Failed to read browser storage state:", error);
    return { ...DEFAULT_STATE };
  }
}

function writeState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function findChat(state, cid) {
  return state.chats.find((item) => item.cid === cid) || null;
}

function ok(data = null, log = "Successfully.") {
  return { flag: true, log, data };
}

function fail(log) {
  return { flag: false, log, data: null };
}

async function urlToDataUrl(url) {
  if (!url || url.startsWith("data:")) return url;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }

  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to convert image to data url"));
    reader.readAsDataURL(blob);
  });
}

async function handleLogin() {
  return ok(null, "Workspace ready.");
}

async function handleGetModels() {
  const state = readState();
  return ok(state.models || "");
}

async function handleSetModels(body) {
  const state = readState();
  state.models = body.data || JSON.stringify(DEFAULT_MODELS);
  writeState(state);
  return ok(null);
}

async function handleGetChatInsTemplateList() {
  const state = readState();
  return ok(state.chatInsTemplateList || "");
}

async function handleSetChatInsTemplateList(body) {
  const state = readState();
  state.chatInsTemplateList = body.data || "[]";
  writeState(state);
  return ok(null);
}

async function handleGetChatList() {
  const state = readState();
  return ok(state.chats.map(({ cid, cname }) => ({ cid, cname })));
}

async function handleAddChat(body) {
  const state = readState();
  if (!findChat(state, body.cid)) {
    state.chats.push({
      cid: body.cid,
      cname: body.cname,
      settings: "",
      messages: [],
    });
    writeState(state);
  }
  return ok(null);
}

async function handleDeleteChat(body) {
  const state = readState();
  state.chats = state.chats.filter((item) => item.cid !== body.cid);
  writeState(state);
  return ok(null);
}

async function handleRenameChat(body) {
  const state = readState();
  const chat = findChat(state, body.cid);
  if (!chat) return fail("Chat not found.");
  chat.cname = body.cname;
  writeState(state);
  return ok(null);
}

async function handleGetAllMessage(body) {
  const state = readState();
  const chat = findChat(state, body.cid);
  return ok(chat?.messages || []);
}

async function handleAddMessage(body) {
  const state = readState();
  const chat = findChat(state, body.cid);
  if (!chat) return fail("Chat not found.");

  const idx = chat.messages.findIndex((item) => item.mid === body.mid);
  const nextItem = { mid: body.mid, message: body.message };
  if (idx >= 0) chat.messages[idx] = nextItem;
  else chat.messages.push(nextItem);

  writeState(state);
  return ok(null);
}

async function handleDeleteMessage(body) {
  const state = readState();
  const chat = findChat(state, body.cid);
  if (!chat) return fail("Chat not found.");

  chat.messages = chat.messages.filter((item) => item.mid !== body.mid);
  writeState(state);
  return ok(null);
}

async function handleGetChatSettings(body) {
  const state = readState();
  const chat = findChat(state, body.cid);
  return ok(chat?.settings || "");
}

async function handleSetChatSettings(body) {
  const state = readState();
  const chat = findChat(state, body.cid);
  if (!chat) return fail("Chat not found.");
  chat.settings = body.data || "";
  writeState(state);
  return ok(null);
}

async function handleGetImageList() {
  const state = readState();
  return ok(state.images || []);
}

async function handlePushImage(body) {
  const state = readState();
  const src = await urlToDataUrl(body.image_url);

  const image = {
    id: body.image_id,
    prompt: body.image_prompt,
    src,
  };

  const idx = state.images.findIndex((item) => item.id === body.image_id);
  if (idx >= 0) state.images[idx] = image;
  else state.images.push(image);

  writeState(state);
  return ok(image);
}

async function handleDeleteImage(body) {
  const state = readState();
  state.images = state.images.filter((item) => item.id !== body.image_id);
  writeState(state);
  return ok(null);
}

const ROUTES = {
  "/_api/login": handleLogin,
  "/_api/user/getModels": handleGetModels,
  "/_api/user/setModels": handleSetModels,
  "/_api/user/getChatInsTemplateList": handleGetChatInsTemplateList,
  "/_api/user/setChatInsTemplateList": handleSetChatInsTemplateList,
  "/_api/chat/getChatList": handleGetChatList,
  "/_api/chat/addChat": handleAddChat,
  "/_api/chat/deleteChat": handleDeleteChat,
  "/_api/chat/renameChat": handleRenameChat,
  "/_api/chat/getAllMessage": handleGetAllMessage,
  "/_api/chat/addMessage": handleAddMessage,
  "/_api/chat/deleteMessage": handleDeleteMessage,
  "/_api/chat/getChatSettings": handleGetChatSettings,
  "/_api/chat/setChatSettings": handleSetChatSettings,
  "/_api/image/getImageList": handleGetImageList,
  "/_api/image/pushImage": handlePushImage,
  "/_api/image/deleteImage": handleDeleteImage,
};

export async function requestBrowserStorage(endpoint, body = {}) {
  const handler = ROUTES[endpoint];
  if (!handler) return fail(`Browser storage route not found: ${endpoint}`);

  try {
    return await handler(body);
  } catch (error) {
    console.error(`Browser storage request failed for ${endpoint}:`, error);
    return fail(error?.message || "Browser storage request failed.");
  }
}
