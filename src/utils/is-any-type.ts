import { tr } from "@/i18n";
import { getChatProviderConnectionFields, isChatModelProvider } from "@/models";

/**
 * Returns whether one user message contains at least one non-empty text part
 * or one valid image URL part.
 */
export function isValidUserMsg(userMsg) {
  if (!userMsg || !userMsg.content || !Array.isArray(userMsg.content)) {
    return false;
  }

  let hasValidContent = false;

  for (let i = 0; i < userMsg.content.length; i++) {
    const item = userMsg.content[i];

    if (item.type === "text" && item.text.trim() !== "") {
      hasValidContent = true;
    }

    if (item.type === "image_url" && item.image_url?.url) {
      hasValidContent = true;
    }
  }

  return hasValidContent;
}

/** Returns whether an unknown value is a valid chat list array payload. */
export function isValidChatInfoArray(data) {
  if (!Array.isArray(data)) {
    return false;
  }

  return data.every((item) => item !== null && typeof item === "object" && typeof item.cid === "string" && typeof item.cname === "string");
}

/** Returns a validation error message for imported model settings data. */
export const getModelSettingValidationError = (data) => {
  if (typeof data !== "object" || data === null) {
    console.error("Model settings validation error: top-level data is not an object:", data);
    return tr("validation.topLevelNotObject");
  }

  const topLevelKeys = ["chat", "image"];
  const presentKeys = topLevelKeys.filter((key) => key in data);

  if (presentKeys.length === 0) {
    console.error("Model settings validation error: missing model list fields:", data);
    return tr("validation.missingModelListFields");
  }

  for (const key of presentKeys) {
    if (!Array.isArray(data[key])) {
      console.error(`Model settings validation error: field "${key}" is not an array:`, data[key]);
      return tr("validation.fieldNotArray", { path: key });
    }
  }

  const hasOwn = (item, field) => Object.prototype.hasOwnProperty.call(item, field);
  const itemPath = (key, index) => `${key}[${index}]`;
  const fieldPath = (path, field) => `${path}.${field}`;

  const requireFields = (item, fields, key, index) => {
    for (const field of fields) {
      if (!hasOwn(item, field)) {
        console.error(`Model settings validation error: missing field "${field}":`, item);
        return tr("validation.missingField", { path: itemPath(key, index), field });
      }
    }
    return "";
  };

  const requireAnyField = (item, fields, key, index) => {
    if (fields.some((field) => hasOwn(item, field))) return "";
    console.error(`Model settings validation error: missing one of fields "${fields.join(" / ")}":`, item);
    return tr("validation.missingOneOfFields", { path: itemPath(key, index), fields: fields.join(" / ") });
  };

  const validateChatModel = (item, key, index) => {
    const provider = item.provider || item.apiType || "";
    if (provider && !isChatModelProvider(provider)) {
      console.error(`Model settings validation error: invalid provider "${provider}":`, item);
      return tr("validation.invalidField", { path: fieldPath(itemPath(key, index), "provider") });
    }

    const commonError = requireFields(item, ["name", "apiKey"], key, index);
    if (commonError) return commonError;
    if (!hasOwn(item, "provider") && !hasOwn(item, "apiType")) {
      console.error("Model settings validation error: missing provider/apiType field:", item);
      return tr("validation.missingOneOfFields", { path: itemPath(key, index), fields: "provider / apiType" });
    }

    const modelError = requireAnyField(item, ["model", "modelType"], key, index);
    if (modelError) return modelError;

    return requireFields(item, getChatProviderConnectionFields(provider), key, index);
  };

  const validateImageModel = (item, key, index) => {
    const provider = item.provider || item.apiType || "";
    if (!["OpenAI", ""].includes(provider)) {
      console.error(`Model settings validation error: invalid provider "${provider}":`, item);
      return tr("validation.invalidField", { path: fieldPath(itemPath(key, index), "provider") });
    }

    const commonError = requireFields(item, ["name", "apiKey"], key, index);
    if (commonError) return commonError;
    if (!hasOwn(item, "provider") && !hasOwn(item, "apiType")) {
      console.error("Model settings validation error: missing provider/apiType field:", item);
      return tr("validation.missingOneOfFields", { path: itemPath(key, index), fields: "provider / apiType" });
    }

    const modelError = requireAnyField(item, ["model", "modelType"], key, index);
    if (modelError) return modelError;

    return requireFields(item, ["baseURL"], key, index);
  };

  for (const key of presentKeys) {
    for (let index = 0; index < data[key].length; index++) {
      const item = data[key][index];
      if (!item || typeof item !== "object") {
        console.error(`Model settings validation error: item is not an object:`, item);
        return tr("validation.notObject", { path: itemPath(key, index) });
      }
      const validationError = key === "chat" ? validateChatModel(item, key, index) : validateImageModel(item, key, index);
      if (validationError) return validationError;
    }
  }

  return "";
};

function isPlainObject(data) {
  return Boolean(data) && typeof data === "object" && !Array.isArray(data);
}

export const getChatTemplateListValidationError = (data, field = "templates") => {
  if (!Array.isArray(data)) {
    console.error(`Chat instruction templates validation error: field "${field}" is not an array:`, data);
    return tr("validation.fieldNotArray", { path: field });
  }

  for (let index = 0; index < data.length; index++) {
    const item = data[index];
    const path = `${field}[${index}]`;
    if (!isPlainObject(item)) {
      console.error(`Chat instruction templates validation error: item is not an object:`, item);
      return tr("validation.notObject", { path });
    }

    if (typeof item.id !== "string") {
      console.error(`Chat instruction templates validation error: field "id" is not a string:`, item);
      return tr("validation.fieldNotString", { path: `${path}.id` });
    }

    if (typeof item.name !== "string") {
      console.error(`Chat instruction templates validation error: field "name" is not a string:`, item);
      return tr("validation.fieldNotString", { path: `${path}.name` });
    }

    if (typeof item.value !== "string") {
      console.error(`Chat instruction templates validation error: field "value" is not a string:`, item);
      return tr("validation.fieldNotString", { path: `${path}.value` });
    }
  }

  return "";
};

function isPlainArray(value) {
  return Array.isArray(value);
}

function isConversationModelSnapshot(value) {
  return (
    isPlainObject(value) &&
    typeof value.modelConfigId === "string" &&
    typeof value.catalogModelId === "string" &&
    typeof value.displayName === "string" &&
    typeof value.provider === "string" &&
    typeof value.apiKey === "string" &&
    isPlainObject(value.modelConfig)
  );
}

export const getChatSessionSettingsValidationError = (data, field = "chatSessions") => {
  if (!isPlainArray(data)) {
    console.error(`Chat session settings validation error: field "${field}" is not an array:`, data);
    return tr("validation.fieldNotArray", { path: field });
  }

  for (let index = 0; index < data.length; index++) {
    const item = data[index];
    const path = `${field}[${index}]`;
    if (!isPlainObject(item)) {
      console.error(`Chat session settings validation error: item is not an object:`, item);
      return tr("validation.notObject", { path });
    }

    if (typeof item.cid !== "string") {
      console.error(`Chat session settings validation error: field "cid" is not a string:`, item);
      return tr("validation.fieldNotString", { path: `${path}.cid` });
    }

    if (typeof item.cname !== "string") {
      console.error(`Chat session settings validation error: field "cname" is not a string:`, item);
      return tr("validation.fieldNotString", { path: `${path}.cname` });
    }

    if (!isPlainObject(item.payload)) {
      console.error(`Chat session settings validation error: field "payload" is not an object:`, item);
      return tr("validation.notObject", { path: `${path}.payload` });
    }

    if ("version" in item.payload && Number(item.payload.version) !== 2) {
      console.error(`Chat session settings validation error: field "version" is not valid:`, item);
      return tr("validation.invalidField", { path: `${path}.payload.version` });
    }

    if ("modelSnapshot" in item.payload && item.payload.modelSnapshot !== null && !isConversationModelSnapshot(item.payload.modelSnapshot)) {
      console.error(`Chat session settings validation error: field "modelSnapshot" is not valid:`, item);
      return tr("validation.invalidField", { path: `${path}.payload.modelSnapshot` });
    }

    if (!isPlainObject(item.payload.settings)) {
      console.error(`Chat session settings validation error: field "settings" is not an object:`, item);
      return tr("validation.notObject", { path: `${path}.payload.settings` });
    }
  }

  return "";
};

export const isSettingsImportPackage = (data) => isPlainObject(data) && "models" in data;

export const getSettingsImportValidationError = (data) => {
  if (isSettingsImportPackage(data)) {
    const modelError = getModelSettingValidationError(data.models);
    if (modelError) {
      console.error("Settings import validation error: invalid model settings:", data.models);
      return tr("validation.modelsPrefix", { error: modelError });
    }

    if ("templates" in data) {
      const templateError = getChatTemplateListValidationError(data.templates, "templates");
      if (templateError) return templateError;
    }

    if ("chatSessions" in data) {
      const chatSessionsError = getChatSessionSettingsValidationError(data.chatSessions, "chatSessions");
      if (chatSessionsError) return chatSessionsError;
    }

    if ("schema" in data && typeof data.schema !== "string") {
      return tr("validation.fieldNotString", { path: "schema" });
    }

    if ("version" in data && typeof data.version !== "string" && !Number.isFinite(Number(data.version))) {
      return tr("validation.fieldNotString", { path: "version" });
    }

    if ("exportedAt" in data && typeof data.exportedAt !== "string") {
      return tr("validation.fieldNotString", { path: "exportedAt" });
    }

    return "";
  }

  return getModelSettingValidationError(data);
};

export const isValidSettingsImport = (data) => !getSettingsImportValidationError(data);
