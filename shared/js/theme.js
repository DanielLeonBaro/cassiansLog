export const THEME_KEY = "dnd-theme";

export function applyTheme(theme, { persist = true } = {}) {
  const next = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  if (persist) localStorage.setItem(THEME_KEY, next);
  const icon = document.getElementById("theme-icon");
  const button = document.getElementById("theme-toggle");
  if (icon) icon.className = next === "dark" ? "bi bi-sun-fill" : "bi bi-moon-stars-fill";
  button?.setAttribute("aria-label", next === "dark" ? "Switch to light theme" : "Switch to dark theme");
  return next;
}

export function initializeTheme() {
  applyTheme(localStorage.getItem(THEME_KEY) || "dark", { persist: false });
  document.getElementById("theme-toggle")?.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(current === "dark" ? "light" : "dark");
  });
}
