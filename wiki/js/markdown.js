// Renders Wiki Markdown through the shared escaped rich-text boundary.
import { renderRichText } from "../../shared/js/rich-text.js";
import { escapeAttribute, escapeHTML } from "../../shared/js/text.js";

export function renderWikiMarkdown(markdown, context) {
  return renderRichText(markdown, {
    imageAttribute: "data-wiki-image",
    resolveMention(name, label) {
      const page = context.pageByName(name);
      return page
        ? `<a href="${context.pageURL(page.id)}" class="wiki-mention" data-page-id="${escapeAttribute(page.id)}">${escapeHTML(label)}</a>`
        : null;
    },
  });
}
