import { tr } from "@/i18n";

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
    return tr("validation.topLevelNotObject");
  }

  const topLevelKeys = ["chat", "image"];
  const presentKeys = topLevelKeys.filter((key) => key in data);

  if (presentKeys.length === 0) {
    return tr("validation.missingModelListFields");
  }

  for (const key of presentKeys) {
    if (!Array.isArray(data[key])) {
      return tr("validation.fieldNotArray", { path: key });
    }
  }

  const hasOwn = (item, field) => Object.prototype.hasOwnProperty.call(item, field);
  const itemPath = (key, index) => `${key}[${index}]`;
  const fieldPath = (path, field) => `${path}.${field}`;

  const requireFields = (item, fields, key, index) => {
    for (const field of fields) {
      if (!hasOwn(item, field)) {
        return tr("validation.missingField", { path: itemPath(key, index), field });
      }
    }
    return "";
  };

  const requireAnyField = (item, fields, key, index) => {
    if (fields.some((field) => hasOwn(item, field))) return "";
    return tr("validation.missingOneOfFields", { path: itemPath(key, index), fields: fields.join(" / ") });
  };

  const validateOptionalArrayField = (item, field, key, index) => {
    if (!hasOwn(item, field)) return "";
    return Array.isArray(item[field]) ? "" : tr("validation.fieldNotArray", { path: fieldPath(itemPath(key, index), field) });
  };

  const validateChatModel = (item, key, index) => {
    const provider = item.provider || item.apiType || "";
    if (!["OpenAI", "Azure OpenAI", "Anthropic", "Azure AI Foundry", ""].includes(provider)) {
      return tr("validation.invalidField", { path: fieldPath(itemPath(key, index), "provider") });
    }

    const commonError = requireFields(item, ["name", "apiKey"], key, index);
    if (commonError) return commonError;
    if (!hasOwn(item, "provider") && !hasOwn(item, "apiType")) {
      return tr("validation.missingOneOfFields", { path: itemPath(key, index), fields: "provider / apiType" });
    }

    const modelError = requireAnyField(item, ["model", "modelType"], key, index);
    if (modelError) return modelError;

    if (provider === "Azure OpenAI") {
      return requireFields(item, ["endpoint", "deployment", "apiVersion"], key, index);
    }

    return requireFields(item, ["baseURL"], key, index);
  };

  const validateImageModel = (item, key, index) => {
    const provider = item.provider || item.apiType || "";
    if (!["OpenAI", "Azure OpenAI", ""].includes(provider)) {
      return tr("validation.invalidField", { path: fieldPath(itemPath(key, index), "provider") });
    }

    const commonError = requireFields(item, ["name", "apiKey"], key, index);
    if (commonError) return commonError;
    if (!hasOwn(item, "provider") && !hasOwn(item, "apiType")) {
      return tr("validation.missingOneOfFields", { path: itemPath(key, index), fields: "provider / apiType" });
    }

    const modelError = requireAnyField(item, ["model", "modelType"], key, index);
    if (modelError) return modelError;

    if (hasOwn(item, "imageOperation") && !["generation", "edit", ""].includes(item.imageOperation)) {
      return tr("validation.invalidField", { path: fieldPath(itemPath(key, index), "imageOperation") });
    }

    if (provider === "Azure OpenAI") {
      return requireFields(item, ["endpoint", "deployment", "apiVersion"], key, index);
    }

    return requireFields(item, ["baseURL"], key, index);
  };

  for (const key of presentKeys) {
    for (let index = 0; index < data[key].length; index++) {
      const item = data[key][index];
      if (!item || typeof item !== "object") {
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
    return tr("validation.fieldNotArray", { path: field });
  }

  for (let index = 0; index < data.length; index++) {
    const item = data[index];
    const path = `${field}[${index}]`;
    if (!isPlainObject(item)) {
      return tr("validation.notObject", { path });
    }

    if (typeof item.id !== "string") {
      return tr("validation.fieldNotString", { path: `${path}.id` });
    }

    if (typeof item.name !== "string") {
      return tr("validation.fieldNotString", { path: `${path}.name` });
    }

    if (typeof item.value !== "string") {
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
    return tr("validation.fieldNotArray", { path: field });
  }

  for (let index = 0; index < data.length; index++) {
    const item = data[index];
    const path = `${field}[${index}]`;
    if (!isPlainObject(item)) {
      return tr("validation.notObject", { path });
    }

    if (typeof item.cid !== "string") {
      return tr("validation.fieldNotString", { path: `${path}.cid` });
    }

    if (typeof item.cname !== "string") {
      return tr("validation.fieldNotString", { path: `${path}.cname` });
    }

    if (!isPlainObject(item.payload)) {
      return tr("validation.notObject", { path: `${path}.payload` });
    }

    if ("version" in item.payload && Number(item.payload.version) !== 2) {
      return tr("validation.invalidField", { path: `${path}.payload.version` });
    }

    if ("modelSnapshot" in item.payload && item.payload.modelSnapshot !== null && !isConversationModelSnapshot(item.payload.modelSnapshot)) {
      return tr("validation.invalidField", { path: `${path}.payload.modelSnapshot` });
    }

    if (!isPlainObject(item.payload.settings)) {
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
