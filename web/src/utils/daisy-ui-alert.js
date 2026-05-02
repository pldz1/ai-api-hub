import errorIcon from "@/assets/svg/error24.svg";
import infoIcon from "@/assets/svg/info24.svg";
import successIcon from "@/assets/svg/success24.svg";
import warnIcon from "@/assets/svg/warn24.svg";
import { createSvgIcon } from "@/utils/svg-icon.js";

// 默认的 svg 图标
const defaultIcons = {
  success: successIcon,
  error: errorIcon,
  info: infoIcon,
  warn: warnIcon,
};

// 默认的 Bootstrap alert 样式类
const defaultClasses = {
  success: "alert alert-success",
  error: "alert alert-error",
  info: "alert alert-info",
  warn: "alert alert-warning",
};

/**
 * 显示一个 alert 提示框
 *
 * @param {Object} options 配置选项
 * @param {('warn'|'info'|'success'|'error')} [options.type='info'] 提示类型，默认 info
 * @param {string} [options.message=''] 提示文本内容
 * @param {string|HTMLElement} [options.icon=''] 自定义图标 URL 或节点，如果为空则使用默认图标
 * @param {number} [options.duration=1500] 显示持续时间（单位：毫秒）
 * @param {HTMLElement} [options.container=null] 挂载的容器元素
 */
export function dsAlert({ type = "info", message = "", icon = "", duration = 1500, container = null } = {}) {
  const iconValue = icon || defaultIcons[type] || "";

  let alertContainer = document.getElementById("custom-daisy-ui-alert");
  if (!alertContainer) {
    alertContainer = document.createElement("div");
    alertContainer.id = "custom-daisy-ui-alert";
    alertContainer.className = "custom-daisy-ui-alert";
  }

  // 创建 alert 元素（不需要额外的容器）
  const alertEl = document.createElement("div");
  alertEl.setAttribute("role", "alert");
  alertEl.className = defaultClasses[type] || defaultClasses.info;

  if (iconValue instanceof HTMLElement) {
    alertEl.appendChild(iconValue);
  } else if (iconValue) {
    alertEl.appendChild(createSvgIcon(iconValue, { size: "24px" }));
  }

  const messageEl = document.createElement("span");
  messageEl.textContent = message;
  alertEl.appendChild(messageEl);

  // 放到容器内
  alertContainer.appendChild(alertEl);

  // 挂载到指定的容器上（默认是 body)
  if (!container) {
    document.body.appendChild(alertContainer);
  } else {
    container.appendChild(alertContainer);
  }

  // 指定时间后自动移除该 alert 元素
  setTimeout(() => {
    alertEl.remove();
  }, duration);
}
