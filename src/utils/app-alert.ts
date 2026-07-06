import errorIcon from "@/assets/svg/error24.svg";
import infoIcon from "@/assets/svg/info24.svg";
import successIcon from "@/assets/svg/success24.svg";
import warnIcon from "@/assets/svg/warn24.svg";
import { createSvgIcon } from "@/utils/svg-icon";

// Default icon(svg)
const defaultIcons = {
  success: successIcon,
  error: errorIcon,
  info: infoIcon,
  warn: warnIcon,
};

// Default Bootstrap alert style classes
const defaultClasses = {
  success: "alert alert-success",
  error: "alert alert-error",
  info: "alert alert-info",
  warn: "alert alert-warning",
};

const alertTimers = new WeakMap<HTMLElement, number>();

function getAlertKey(type: string, message: string) {
  return `${type}:${message}`;
}

function resetAlertTimer(alertEl: HTMLElement, duration: number, alertContainer: HTMLElement) {
  const previousTimer = alertTimers.get(alertEl);
  if (previousTimer) {
    window.clearTimeout(previousTimer);
  }

  const timer = window.setTimeout(() => {
    alertEl.remove();

    if (!alertContainer.childElementCount) {
      alertContainer.remove();
    }
  }, duration);

  alertTimers.set(alertEl, timer);
}

/**
 * Display an alert dialog box.
 *
 * @param {Object} options Configuration options.
 * @param {('warn'|'info'|'success'|'error')} [options.type='info'] Prompt type, default info.
 * @param {string} [options.message=''] contxt.
 * @param {string|HTMLElement} [options.icon=''] Custom icon URL or node, use default icon if empty.
 * @param {number} [options.duration=1500] Display duration (in milliseconds).
 * @param {HTMLElement} [options.container=null] Mounted container element.
 */
export function dsAlert({ type = "info", message = "", icon = "", duration = 1500, container = null } = {}) {
  const iconValue = icon || defaultIcons[type] || "";
  const alertKey = getAlertKey(type, message);

  let alertContainer = document.getElementById("custom-app-alert");
  if (!alertContainer) {
    alertContainer = document.createElement("div");
    alertContainer.id = "custom-app-alert";
    alertContainer.className = "custom-app-alert";
  }

  const existingAlert = Array.from(alertContainer.children).find(
    (child): child is HTMLElement => child instanceof HTMLElement && child.dataset.alertKey === alertKey,
  );
  if (existingAlert) {
    resetAlertTimer(existingAlert, duration, alertContainer);
    return existingAlert;
  }

  // 👉 Create an alert element (no additional containers needed)
  const alertEl = document.createElement("div");
  alertEl.setAttribute("role", "alert");
  alertEl.className = defaultClasses[type] || defaultClasses.info;
  alertEl.dataset.alertKey = alertKey;

  if (iconValue instanceof HTMLElement) {
    alertEl.appendChild(iconValue);
  } else if (iconValue) {
    alertEl.appendChild(createSvgIcon(iconValue, { size: "24px" }));
  }

  const messageEl = document.createElement("span");
  messageEl.textContent = message;
  alertEl.appendChild(messageEl);

  // Place it in the container.
  alertContainer.appendChild(alertEl);

  // Mount to the specified container (default is body)
  if (!container) {
    document.body.appendChild(alertContainer);
  } else {
    container.appendChild(alertContainer);
  }

  resetAlertTimer(alertEl, duration, alertContainer);

  return alertEl;
}
