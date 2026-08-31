// Converts a constrained Markdown-like syntax into escaped safe HTML.
import { escapeAttribute, escapeHTML } from "./text.js";

function renderInline(text, {
  imageAttribute = "data-rich-image",
  resolveMention = () => null,
} = {}) {
  const expression = /!\[([^\]]*)\]\(((?:https?:\/\/|data:image\/)[^)]+)\)|\[\[([^\]|]+)(?:\|([^\]]+))?\]\]|\[([^\]]+)\]\((https?:\/\/[^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`/g;
  let output = "";
  let lastIndex = 0;
  let match;
  while ((match = expression.exec(text))) {
    output += escapeHTML(text.slice(lastIndex, match.index));
    if (match[1] !== undefined) {
      const label = match[1] || "Reference image";
      output += `<img src="${escapeAttribute(match[2])}" alt="${escapeAttribute(match[1])}" loading="lazy" ${imageAttribute} role="button" tabindex="0" aria-label="View ${escapeAttribute(label)} full size">`;
    } else if (match[3] !== undefined) {
      const name = match[3].trim();
      const label = (match[4] || match[3]).trim();
      const mention = resolveMention(name, label);
      output += mention || `<span class="wiki-mention wiki-mention-missing" title="Page not found: ${escapeAttribute(name)}">${escapeHTML(label)}</span>`;
    } else if (match[5] !== undefined) {
      output += `<a href="${escapeAttribute(match[6])}" target="_blank" rel="noopener noreferrer">${escapeHTML(match[5])}</a>`;
    } else if (match[7] !== undefined) output += `<strong>${escapeHTML(match[7])}</strong>`;
    else if (match[8] !== undefined) output += `<em>${escapeHTML(match[8])}</em>`;
    else output += `<code class="rounded bg-stone-200 px-1.5 py-0.5 text-sm dark:bg-white/10">${escapeHTML(match[9])}</code>`;
    lastIndex = expression.lastIndex;
  }
  return output + escapeHTML(text.slice(lastIndex));
}

export function renderRichText(markdown, options = {}) {
  const inline = (value) => renderInline(value, options);
  const lines = String(markdown || "").replace(/\r\n?/g, "\n").split("\n");
  const output = [];
  let index = 0;
  const special = (line) => /^#{2,4}\s+/.test(line) || /^>\s?/.test(line) || /^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line) || /^---+$/.test(line);
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) { index += 1; continue; }
    const heading = line.match(/^(#{2,4})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      output.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }
    if (/^---+$/.test(line)) {
      output.push('<hr class="my-8 border-stone-300 dark:border-white/10">');
      index += 1;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const items = [];
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) items.push(lines[index++].trim().replace(/^>\s?/, ""));
      output.push(`<blockquote>${items.map(inline).join("<br>")}</blockquote>`);
      continue;
    }
    const list = /^[-*]\s+/.test(line) ? { pattern: /^[-*]\s+/, tag: "ul" }
      : /^\d+\.\s+/.test(line) ? { pattern: /^\d+\.\s+/, tag: "ol" } : null;
    if (list) {
      const items = [];
      while (index < lines.length && list.pattern.test(lines[index].trim())) items.push(lines[index++].trim().replace(list.pattern, ""));
      output.push(`<${list.tag}>${items.map((item) => `<li>${inline(item)}</li>`).join("")}</${list.tag}>`);
      continue;
    }
    const paragraph = [line];
    index += 1;
    while (index < lines.length && lines[index].trim() && !special(lines[index].trim())) paragraph.push(lines[index++].trim());
    output.push(`<p>${inline(paragraph.join(" "))}</p>`);
  }
  return output.join("");
}
