import { createI18n } from "vue-i18n";
import { languages, cn } from "./language";

export const APP_LOCALE_KEY = "ai-api-hub-locale";

function detectLocale() {
  if (typeof window !== "undefined") {
    const storedLocale = window.localStorage.getItem(APP_LOCALE_KEY);
    if (storedLocale) return storedLocale;
  }
  if (typeof navigator === "undefined") return "zh-CN";
  return navigator.language?.toLowerCase().startsWith("zh") ? "zh-CN" : "en-US";
}

const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: cn,
  messages: languages,
});

export function setAppLocale(locale) {
  const nextLocale = locale || cn;
  i18n.global.locale.value = nextLocale;
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("lang", nextLocale);
  }
  if (typeof window !== "undefined") {
    window.localStorage.setItem(APP_LOCALE_KEY, nextLocale);
  }
}

export function tr(key: string, params = {}) {
  return i18n.global.t(key, params);
}

export default i18n;
