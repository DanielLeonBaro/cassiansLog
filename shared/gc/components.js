import { escapeHTML, escapeAttribute } from "../js/text.js";
import { createDialogController } from "../js/dialog.js";

export { createDialogController } from "../js/dialog.js";

export function renderButton({ label, icon = "", variant = "secondary", disabled = false, type = "button" }) {
  return `<button type="${escapeAttribute(type)}" class="gc-button" data-variant="${escapeAttribute(variant)}"${disabled ? " disabled" : ""}>${icon ? `<i class="bi ${escapeAttribute(icon)}" aria-hidden="true"></i>` : ""}${escapeHTML(label)}</button>`;
}

export function renderBadge({ label, tone = "neutral" }) {
  return `<span class="gc-badge" data-tone="${escapeAttribute(tone)}">${escapeHTML(label)}</span>`;
}

export function renderState({ title, message = "", kind = "empty" }) {
  return `<div class="gc-state" data-state="${escapeAttribute(kind)}"${kind === "loading" ? ' role="status"' : kind === "error" ? ' role="alert"' : ""}><strong>${escapeHTML(title)}</strong><p>${escapeHTML(message)}</p></div>`;
}

export function createDrawerController(element, options = {}) {
  return createDialogController(element, options);
}

export function createMenuController(button, menu) {
  const close = ({ focus = false } = {}) => {
    menu.classList.add("hidden");
    button.setAttribute("aria-expanded", "false");
    if (focus) button.focus();
  };
  const toggle = () => {
    const open = button.getAttribute("aria-expanded") !== "true";
    button.setAttribute("aria-expanded", String(open));
    menu.classList.toggle("hidden", !open);
  };
  const outside = (event) => { if (!menu.contains(event.target) && !button.contains(event.target)) close(); };
  const keyboard = (event) => {
    if (event.key === "Escape" && button.getAttribute("aria-expanded") === "true") close({ focus: true });
  };
  button.addEventListener("click", toggle);
  document.addEventListener("click", outside);
  document.addEventListener("keydown", keyboard);
  return { close, destroy() {
    button.removeEventListener("click", toggle);
    document.removeEventListener("click", outside);
    document.removeEventListener("keydown", keyboard);
  } };
}

// Static pages carry semantic classes. This adapter handles existing dynamic views
// without touching their data/action attributes, state classes, or event listeners.
export function enhanceComponents(root = document.body) {
  if (!root) return;
  const classify = (element) => {
    if (!(element instanceof Element)) return;
    if (element.matches("button")) {
      element.classList.add("gc-button");
      if (!element.dataset.variant && element.className.includes("bg-blood-")) element.dataset.variant = "primary";
      else if (!element.dataset.variant && element.className.includes("bg-danger-")) element.dataset.variant = "danger";
    } else if (element.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="hidden"]), select, textarea')) {
      element.classList.add("gc-field");
    } else if (element.matches("table")) element.classList.add("gc-table");
    else if (element.matches("[role=tablist]")) element.classList.add("gc-tabs");
    else if (element.matches("[role=dialog]")) element.classList.add("gc-overlay");
    else if (element.matches("section, article, details, form") && /(?:rounded-2xl|rounded-3xl)/.test(element.className) && /\bborder\b/.test(element.className)) element.classList.add("gc-panel");
  };
  const visit = (node) => {
    classify(node);
    node.querySelectorAll?.("button, input, select, textarea, table, [role=tablist], [role=dialog], section, article, details, form").forEach(classify);
  };
  visit(root);
  const observer = new MutationObserver((records) => {
    for (const record of records) for (const node of record.addedNodes) visit(node);
  });
  observer.observe(root, { childList: true, subtree: true });
  return () => observer.disconnect();
}
