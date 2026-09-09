// Supplies one cursor-aware formatting toolbar for every constrained-Markdown editor.
import { escapeAttribute } from "./text.js";

const FORMATS = {
  heading: { kind: "line", prefix: "## " },
  heading3: { kind: "line", prefix: "### " },
  heading4: { kind: "line", prefix: "#### " },
  bold: { kind: "wrap", before: "**", after: "**" },
  italic: { kind: "wrap", before: "*", after: "*" },
  bullets: { kind: "line", prefix: "- " },
  numbered: { kind: "line", prefix: "1. " },
  quote: { kind: "line", prefix: "> " },
  link: { kind: "wrap", before: "[", after: "](https://)" },
  image: { kind: "wrap", before: "![", after: "](https://)" },
  mention: { kind: "wrap", before: "[[", after: "]]" },
  code: { kind: "wrap", before: "`", after: "`" },
  divider: { kind: "divider" },
};

const BUTTONS = [
  ["heading", "bi-type-h2", "Heading 2"],
  ["heading3", "bi-type-h3", "Heading 3"],
  ["heading4", "bi-type-h4", "Heading 4"],
  ["bold", "bi-type-bold", "Bold"],
  ["italic", "bi-type-italic", "Italic"],
  ["bullets", "bi-list-ul", "Bulleted list"],
  ["numbered", "bi-list-ol", "Numbered list"],
  ["quote", "bi-quote", "Quote"],
  ["link", "bi-link-45deg", "Link"],
  ["image", "bi-image", "Image"],
  ["mention", "bi-book", "Wiki mention"],
  ["code", "bi-code", "Inline code"],
  ["divider", "bi-dash-lg", "Divider"],
];

export const STANDARD_MARKDOWN_FORMATS = [
  "heading",
  "heading3",
  "heading4",
  "bold",
  "italic",
  "bullets",
  "numbered",
  "quote",
  "link",
  "code",
  "divider",
];

export const COMPACT_MARKDOWN_FORMATS = [
  "bold",
  "italic",
  "bullets",
  "numbered",
  "quote",
  "link",
  "code",
];

export function markdownToolbarMarkup(label = "Formatting", formats = null) {
  const allowed = formats ? new Set(formats) : null;
  const buttons = allowed ? BUTTONS.filter(([format]) => allowed.has(format)) : BUTTONS;
  const buttonClass = "inline-flex h-9 items-center gap-1.5 rounded-lg border border-stone-300 bg-white/70 px-2.5 text-xs font-bold text-stone-700 transition hover:border-blood-500 hover:text-blood-500 dark:border-white/15 dark:bg-white/5 dark:text-stone-200";
  return `<div class="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="${escapeAttribute(label)}">${buttons.map(([format, icon, title]) => `<button type="button" data-markdown-format="${format}" class="${buttonClass}" title="${escapeAttribute(title)}" aria-label="${escapeAttribute(title)}"><i class="bi ${icon}" aria-hidden="true"></i><span class="hidden sm:inline">${title}</span></button>`).join("")}</div>`;
}

function wrapEdit(value, start, end, format) {
  const selected = value.slice(start, end);
  const replacement = `${format.before}${selected}${format.after}`;
  const contentStart = start + format.before.length;
  return {
    value: value.slice(0, start) + replacement + value.slice(end),
    selectionStart: contentStart,
    selectionEnd: selected ? contentStart + selected.length : contentStart,
  };
}

function lineEdit(value, start, end, prefix) {
  const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const selectionEndsAtLineStart = end > start && value[end - 1] === "\n";
  const contentEnd = selectionEndsAtLineStart ? end - 1 : end;
  const replacement = value.slice(lineStart, contentEnd).split("\n").map((line) => `${prefix}${line}`).join("\n");
  const nextValue = value.slice(0, lineStart) + replacement + value.slice(contentEnd);
  if (start === end) {
    return {
      value: nextValue,
      selectionStart: start + prefix.length,
      selectionEnd: start + prefix.length,
    };
  }
  return {
    value: nextValue,
    selectionStart: lineStart + prefix.length,
    selectionEnd: lineStart + replacement.length + (selectionEndsAtLineStart ? 1 : 0),
  };
}

function dividerEdit(value, start, end) {
  const before = start > 0 && value[start - 1] !== "\n" ? "\n" : "";
  const replacement = `${before}---\n`;
  const cursor = start + replacement.length;
  return {
    value: value.slice(0, start) + replacement + value.slice(end),
    selectionStart: cursor,
    selectionEnd: cursor,
  };
}

export function markdownEdit(value, start, end, formatName) {
  const format = FORMATS[formatName];
  if (!format) return { value, selectionStart: start, selectionEnd: end };
  if (format.kind === "wrap") return wrapEdit(value, start, end, format);
  if (format.kind === "line") return lineEdit(value, start, end, format.prefix);
  return dividerEdit(value, start, end);
}

export function applyMarkdownFormat(textarea, formatName) {
  if (!textarea) return;
  const edit = markdownEdit(textarea.value, textarea.selectionStart, textarea.selectionEnd, formatName);
  textarea.value = edit.value;
  textarea.focus();
  textarea.setSelectionRange(edit.selectionStart, edit.selectionEnd);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

export function handleMarkdownToolbarClick(event) {
  const button = event.target.closest("[data-markdown-format]");
  if (!button) return false;
  const editor = button.closest("[data-markdown-editor]");
  const textarea = editor?.querySelector("textarea");
  if (!textarea) return false;
  applyMarkdownFormat(textarea, button.dataset.markdownFormat);
  return true;
}
