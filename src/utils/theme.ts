const APP_THEME_KEY = "ai-api-hub-theme";
const DEFAULT_THEME = "light";

function normalizeTheme(theme) {
  return (theme || "").trim() || DEFAULT_THEME;
}

export function getStoredTheme() {
  try {
    return normalizeTheme(localStorage.getItem(APP_THEME_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

export function applyTheme(theme = DEFAULT_THEME) {
  const nextTheme = normalizeTheme(theme);

  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", nextTheme);
  }

  try {
    localStorage.setItem(APP_THEME_KEY, nextTheme);
  } catch {
    // ignore storage failures
  }

  return nextTheme;
}
