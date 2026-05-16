import { tr } from "@/i18n";

/**
 * 检测 string 变量是不是能够被解析成一个数组
 * @param {*} jsonStr
 * @returns
 */
export function isArrayTypeStr(jsonStr) {
  try {
    const parsedData = JSON.parse(jsonStr);
    // 判断解析后的数据是否是数组
    return Array.isArray(parsedData);
  } catch (error) {
    // 如果 JSON.parse 失败（例如无效的 JSON 字符串），返回 false
    return false;
  }
}

/**
 * 验证用户消息是否有效。
 *
 * 一个消息对象被认为是有效的，如果它包含至少一个非空的文本或者有效的图片 URL。
 * 具体来说：
 * - 如果`content`数组为空，或者只有空文本消息，则视为无效。
 * - 如果存在图片消息，则图片 URL 必须有效。
 *
 * @param {Object} userMsg - 用户消息对象。
 * @param {string} userMsg.role - 消息的角色（例如："user"）。
 * @param {Array} userMsg.content - 消息内容数组，数组中每个元素代表一个消息片段。
 * @param {Object} userMsg.content[] - 内容数组中的每个消息项。
 * @param {string} userMsg.content[].type - 内容类型，可能的值为 `"text"` 或 `"image_url"`。
 * @param {string} [userMsg.content[].text] - 当`type`为`"text"`时的文本内容。
 * @param {Object} [userMsg.content[].image_url] - 当`type`为`"image_url"`时的图片信息。
 * @param {string} userMsg.content[].image_url.url - 图片的URL。
 *
 * @returns {boolean} 如果消息有效，则返回`true`，否则返回`false`。
 */
export function isValidUserMsg(userMsg) {
  if (!userMsg || !userMsg.content || !Array.isArray(userMsg.content)) {
    return false;
  }

  // 用于追踪是否有有效内容
  let hasValidContent = false;

  for (let i = 0; i < userMsg.content.length; i++) {
    const item = userMsg.content[i];

    // 如果是文本类型，并且文本非空
    if (item.type === "text" && item.text.trim() !== "") {
      hasValidContent = true;
    }

    // 如果是图片类型，确保 image_url 存在且不为空
    if (item.type === "image_url" && item.image_url?.url) {
      hasValidContent = true;
    }
  }

  return hasValidContent;
}

/**
 * 对话列表元素类型
 * @typedef {Object} ChatInfo
 * @property {string} cid - 对话的id
 * @property {string} cname - 对话的名称
 */

/**
 * 判断返回的数据是否是符合ChatInfo类型的对象数组
 * @param {Array} data - 要验证的数据
 * @returns {boolean} - 如果是符合要求的数组返回true，否则返回false
 */
export function isValidChatInfoArray(data) {
  // 检查是否是数组
  if (!Array.isArray(data)) {
    return false;
  }

  // 遍历数组中的每个元素，检查每个元素是否符合ChatInfo类型
  return data.every((item) => item !== null && typeof item === "object" && typeof item.cid === "string" && typeof item.cname === "string");
}

/**
 * 判断 json 的数据, 是不是有效的模型设置
 */
export const getModelSettingValidationError = (data) => {
  if (typeof data !== "object" || data === null) {
    return tr("validation.topLevelNotObject");
  }

  const topLevelKeys = ["chat", "image", "imageGeneration", "imageEdit"];
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

    const chatParamDefsError = validateOptionalArrayField(item, "chatParamDefs", key, index);
    if (chatParamDefsError) return chatParamDefsError;

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

    const imageParamDefsError = validateOptionalArrayField(item, "imageParamDefs", key, index);
    if (imageParamDefsError) return imageParamDefsError;

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

export const isValidModelSetting = (data) => !getModelSettingValidationError(data);

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
