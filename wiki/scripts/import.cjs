const fs = require("node:fs");
const path = require("node:path");
const Y = require("yjs");
const { writeJSON } = require("../../shared/build/output.cjs");

const SOURCE_URL = "https://apotheosisoftherings.vvd.world";
const OUTPUT_PATH = path.join(__dirname, "..", "data", "pages.json");
const MEDIA_BASE = "https://vvd-public-media.zied-8e7.workers.dev";
const REQUEST_TIMEOUT_MS = 30_000;
const REQUEST_ATTEMPTS = 3;

function flightStrings(html) {
  const expression = /<script(?:\s[^>]*)?>\s*self\.__next_f\.push\(\[1,("(?:\\.|[^"\\])*")\]\)\s*<\/script>/g;
  return [...html.matchAll(expression)].map((match) => JSON.parse(match[1]));
}

function extractBalancedObject(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Could not find ${marker}`);
  const start = source.indexOf("{", markerIndex);
  return parseBalancedObject(source, start, marker);
}

function parseBalancedObject(source, start, label = "object") {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}" && --depth === 0) {
      return JSON.parse(source.slice(start, index + 1));
    }
  }
  throw new Error(`Could not parse ${label}`);
}

function extractEnclosingObject(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Could not find ${marker}`);
  const stack = [];
  let inString = false;
  let escaped = false;
  for (let index = 0; index < markerIndex; index += 1) {
    const character = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
    } else if (character === '"') inString = true;
    else if (character === "{") stack.push(index);
    else if (character === "}") stack.pop();
  }
  for (const start of [...stack].reverse()) {
    try {
      return parseBalancedObject(source, start, marker);
    } catch {
      // Try the next enclosing object.
    }
  }
  throw new Error(`Could not parse the object containing ${marker}`);
}

function getPublishedContent(html) {
  const payload = flightStrings(html).join("\n");
  if (!payload) throw new Error("The site returned no readable published data");
  if (payload.includes('"content":{"maps":')) {
    return { format: "legacy", content: extractBalancedObject(payload, '"content":{"maps":') };
  }
  const bundle = extractEnclosingObject(payload, '"appId":"wiki"');
  if (!bundle.snapshot?.documents) throw new Error("The current published snapshot has no documents");
  return { format: "snapshot", bundle };
}

function getEntityUpdates(html) {
  const candidates = [];
  for (const value of flightStrings(html)) {
    for (const match of value.matchAll(/(?:^|[^A-Za-z0-9+/=])([A-Za-z0-9+/]{1000,}={0,2})(?=$|[^A-Za-z0-9+/=])/g)) {
      candidates.push(match[1]);
    }
  }
  return [...new Set(candidates)].sort((a, b) => b.length - a.length).map((value) => Buffer.from(value, "base64"));
}

function decodeEntityDocument(updates) {
  const errors = [];
  for (const update of updates) {
    let discovery;
    let document;
    try {
      discovery = new Y.Doc();
      Y.applyUpdate(discovery, update);
      const keys = [...discovery.share.keys()];
      discovery.destroy();
      discovery = null;

      document = new Y.Doc();
      keys.forEach((key) => {
        if (key === "default" || key.startsWith("textblock-")) document.getXmlFragment(key);
        else document.getMap(key);
      });
      Y.applyUpdate(document, update);

      const root = document.getXmlFragment("default");
      const body = root.toArray().find((node) => node.nodeName === "contentBody");
      const header = root.toArray().find((node) => node.nodeName === "cardHeader");
      if (!body && !header) throw new Error("Yjs data had no page body or header");
      return {
        sections: body?.getAttribute("sections") || [],
        header: header?.getAttributes() || {},
      };
    } catch (error) {
      errors.push(error.message);
    } finally {
      discovery?.destroy();
      document?.destroy();
    }
  }
  throw new Error(errors[0] || "Could not find the page's published document");
}

function applyMarks(text, marks = []) {
  let value = text || "";
  if (marks.some((mark) => mark.type === "code")) value = `\`${value}\``;
  if (marks.some((mark) => mark.type === "bold" || mark.type === "strong")) value = `**${value}**`;
  if (marks.some((mark) => mark.type === "italic" || mark.type === "em")) value = `*${value}*`;
  if (marks.some((mark) => mark.type === "strike")) value = `~~${value}~~`;
  const link = marks.find((mark) => mark.type === "link" && mark.attrs?.href);
  if (link) value = `[${value}](${link.attrs.href})`;
  return value;
}

function inlineContent(nodes = [], entityNames) {
  if (!Array.isArray(nodes)) nodes = nodes?.content || [];
  return nodes.map((node) => {
    if (node.type === "text") return applyMarks(node.text, node.marks);
    if (node.type === "hardBreak") return "  \n";
    if (node.type === "mention") {
      const target = entityNames.get(node.attrs?.id) || node.attrs?.label || "Unknown page";
      const label = node.attrs?.label || target;
      return target === label ? `[[${target}]]` : `[[${target}|${label}]]`;
    }
    if (node.type === "image" && node.attrs?.src) {
      return `![${node.attrs.alt || "Image"}](${node.attrs.src})`;
    }
    return node.content ? inlineContent(node.content, entityNames) : "";
  }).join("");
}

function richText(nodes = [], entityNames, depth = 0) {
  if (!Array.isArray(nodes)) nodes = nodes?.content || [];
  const lines = [];
  nodes.forEach((node) => {
    if (node.type === "paragraph") {
      lines.push(inlineContent(node.content, entityNames), "");
    } else if (node.type === "heading") {
      const level = Math.min(6, Math.max(2, Number(node.attrs?.level) || 2));
      lines.push(`${"#".repeat(level)} ${inlineContent(node.content, entityNames)}`, "");
    } else if (node.type === "quote" || node.type === "blockquote") {
      const quote = richText(node.content, entityNames, depth).trim();
      quote.split("\n").forEach((line) => lines.push(`> ${line}`));
      if (node.attrs?.attribution) lines.push(`> — ${node.attrs.attribution}`);
      lines.push("");
    } else if (node.type === "bulletList" || node.type === "orderedList") {
      (node.content || []).forEach((item, index) => {
        const prefix = node.type === "orderedList" ? `${index + 1}.` : "-";
        lines.push(`${"  ".repeat(depth)}${prefix} ${richText(item.content, entityNames, depth + 1).trim()}`);
      });
      lines.push("");
    } else if (node.type === "listItem") {
      lines.push(richText(node.content, entityNames, depth));
    } else if (node.type === "codeBlock") {
      lines.push(`\`\`\`${node.attrs?.language || ""}`, inlineContent(node.content, entityNames), "\`\`\`", "");
    } else if (node.type === "horizontalRule") {
      lines.push("---", "");
    } else if (node.type === "image" && node.attrs?.src) {
      lines.push(`![${node.attrs.alt || "Image"}](${node.attrs.src})`, "");
    } else if (node.content) {
      lines.push(richText(node.content, entityNames, depth));
    }
  });
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function sectionsToMarkdown(sections, entityNames) {
  const output = [];
  sections.forEach((section) => {
    (section.blocks || []).forEach((block) => {
      if (block.type === "text") {
        if (block.title) output.push(`## ${block.title}`);
        const text = richText(block.content, entityNames);
        if (text) output.push(text);
      } else if (block.type === "media" && block.mediaId) {
        const mediaUrl = String(block.mediaId).startsWith("http") ? block.mediaId : `${MEDIA_BASE}/${block.mediaId}`;
        output.push(`![${block.caption || "Campaign artwork"}](${mediaUrl})`);
        if (block.caption) output.push(`*${block.caption}*`);
      } else if (block.type === "timeline") {
        output.push(`## ${block.title || block.timelineName || "Timeline"}`);
        output.push("[[La historia de Breugaire]]");
      }
    });
  });
  return output.join("\n\n").trim();
}

function summaryFromMarkdown(markdown, fallback) {
  const summary = markdown
    .replace(/^#{1,6}\s+.*$/gm, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, label) => label || target)
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[>*_#`\[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return summary ? `${summary.slice(0, 210).trim()}${summary.length > 210 ? "…" : ""}` : fallback;
}

function absoluteUrl(value) {
  if (!value) return "";
  try {
    return new URL(value, `${SOURCE_URL}/`).href;
  } catch {
    return String(value);
  }
}

function timelineMarkdown(timeline, entityNames) {
  const data = timeline.data || timeline;
  const lines = [];
  (data.ages || []).forEach((age) => {
    lines.push(`## ${age.label}`, age.description || "", "");
  });
  lines.push("## Events", "");
  (data.events || []).forEach((event) => {
    lines.push(`### ${event.label}`);
    if (event.imageUrl) lines.push(`![${event.label}](${absoluteUrl(event.imageUrl)})`);
    const description = String(event.description || "").replace(/^\$\d+$/, "");
    if (description) lines.push(description);
    lines.push("");
  });
  let markdown = lines.join("\n").trim();
  for (const name of [...entityNames.values()].sort((a, b) => b.length - a.length)) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    markdown = markdown.replace(new RegExp(`(?<!\\[\\[)\\b${escaped}\\b(?![^\\[]*\\]\\])`, "g"), `[[${name}]]`);
  }
  return markdown;
}

function familyTreeMarkdown(tree) {
  const nodes = tree?.jsonContent?.nodes || tree?.tree?.nodes || [];
  const people = nodes.filter((node) => node.label && node.kind !== "junction");
  return [
    "## Members",
    ...people.map((person) => `- ${person.label}`),
    "",
    "*The published campaign source contains the relationship graph; this local page preserves its listed members and can be expanded with additional notes.*",
  ].join("\n");
}

function typeMap(content) {
  return new Map(content.entityTypes.map((type) => [type.id, type.name]));
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchText(url) {
  let lastError;
  for (let attempt = 1; attempt <= REQUEST_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "CassiansLogWikiImporter/1.0" },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return await response.text();
    } catch (error) {
      lastError = new Error(`${error.message}: ${url}`);
      if (attempt < REQUEST_ATTEMPTS) await sleep(500 * attempt);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

function snapshotMediaUrl(snapshot, mediaIdOrUrl) {
  if (!mediaIdOrUrl) return "";
  return absoluteUrl(snapshot.mediaUrls?.[mediaIdOrUrl] || mediaIdOrUrl);
}

async function importSnapshotPages(bundle) {
  const snapshot = bundle.snapshot;
  const entityNames = new Map(snapshot.documents.map((document) => [document.id, document.name]).filter(([, name]) => name));
  const pages = [];

  for (const [index, document] of snapshot.documents.entries()) {
    process.stdout.write(`[${index + 1}/${snapshot.documents.length}] ${document.name || `(unnamed ${document.documentType})`}... `);
    const route = snapshot.routes?.[document.id] || `/${document.slug}`;
    const html = await fetchText(absoluteUrl(route));
    const routeData = getPublishedContent(html);
    if (routeData.format !== "snapshot") throw new Error(`Unexpected legacy payload for ${document.name || document.id}`);
    const embedded = routeData.bundle.snapshot.embeds?.[document.id];
    if (!embedded) throw new Error(`No published content found for ${document.name || document.id}`);
    if (!document.name) {
      console.log("skipped unnamed document");
      continue;
    }
    const source = absoluteUrl(route);

    if (document.documentType === "card") {
      const header = embedded.content?.find((node) => node.type === "cardHeader")?.attrs || {};
      const sections = embedded.content?.find((node) => node.type === "contentBody")?.attrs?.sections || [];
      const body = sectionsToMarkdown(sections, entityNames);
      const type = snapshot.entityTypes?.[document.entityTypeId]?.name || "Lore";
      pages.push({
        id: document.id,
        name: header.name || document.name,
        type,
        aliases: header.aliases || document.aliases || [],
        banner: snapshotMediaUrl(snapshot, header.banner || header.avatar || document.avatarMediaId),
        summary: summaryFromMarkdown(body, `A ${type.toLowerCase()} entry from the published Breugaire campaign.`),
        body,
        source,
        imported: true,
      });
    } else if (document.documentType === "timeline") {
      const body = timelineMarkdown(embedded, entityNames);
      pages.push({
        id: document.id,
        name: document.name,
        type: "History",
        aliases: document.aliases?.length ? document.aliases : ["Timeline", "Historia"],
        banner: snapshotMediaUrl(snapshot, embedded.events?.find((event) => event.imageUrl)?.imageUrl || snapshot.world.avatarMediaId),
        summary: summaryFromMarkdown(body, "The published history of Breugaire."),
        body,
        source,
        imported: true,
      });
    } else if (document.documentType === "map") {
      const background = snapshotMediaUrl(snapshot, embedded.background?.mediaId || embedded.background?.url);
      pages.push({
        id: document.id,
        name: document.name,
        type: "Map",
        aliases: document.aliases?.length ? document.aliases : ["World map", "Mapa"],
        banner: background || snapshotMediaUrl(snapshot, snapshot.world.avatarMediaId),
        summary: "The published world map of Breugaire.",
        body: background ? `## World map\n\n![${document.name}](${background})` : "## World map",
        source,
        imported: true,
      });
    } else if (document.documentType === "family-tree-v2" || document.documentType === "family-tree") {
      const body = familyTreeMarkdown(embedded);
      pages.push({
        id: document.id,
        name: document.name,
        type: "Family Tree",
        aliases: document.aliases?.length ? document.aliases : ["Árbol genealógico"],
        banner: snapshotMediaUrl(snapshot, snapshot.world.avatarMediaId),
        summary: summaryFromMarkdown(body, "The published family tree."),
        body,
        source,
        imported: true,
      });
    } else {
      pages.push({
        id: document.id,
        name: document.name,
        type: document.documentType,
        aliases: document.aliases || [],
        banner: snapshotMediaUrl(snapshot, document.avatarMediaId),
        summary: `A published ${document.documentType} document.`,
        body: `## Published ${document.documentType}`,
        source,
        imported: true,
      });
    }
    console.log("done");
  }
  return pages;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const { normalizeWikiPages } = await import("../js/model.js");
  console.log(`Importing published wiki from ${SOURCE_URL}`);
  const home = await fetchText(`${SOURCE_URL}/`);
  const published = getPublishedContent(home);
  if (published.format === "snapshot") {
    const pages = await importSnapshotPages(published.bundle);
    if (!dryRun) writeJSON(OUTPUT_PATH, normalizeWikiPages(pages), true);
    console.log(dryRun ? `Dry run passed with ${pages.length} pages; pages.json was not changed` : `Wrote ${pages.length} pages to ${OUTPUT_PATH}`);
    return;
  }
  const content = published.content;
  const entityNames = new Map(content.entities.map((entity) => [entity.id, entity.name]));
  const types = typeMap(content);
  const pages = [];

  const failures = [];
  for (const [index, entity] of content.entities.entries()) {
    process.stdout.write(`[${index + 1}/${content.entities.length}] ${entity.name}... `);
    try {
      const html = await fetchText(`${SOURCE_URL}/wiki/${entity.slug}`);
      const document = decodeEntityDocument(getEntityUpdates(html));
      const body = sectionsToMarkdown(document.sections, entityNames);
      const type = types.get(entity.entityTypeId) || "Lore";
      pages.push({
        id: entity.id,
        name: entity.name,
        type,
        aliases: entity.aliases || [],
        banner: entity.banner || entity.avatar || "",
        summary: summaryFromMarkdown(body, `A ${type.toLowerCase()} entry from the published Breugaire campaign.`),
        body,
        source: `${SOURCE_URL}/wiki/${entity.slug}`,
        imported: true,
      });
      console.log(body ? "done" : "metadata only");
    } catch (error) {
      console.log(`failed (${error.message})`);
      failures.push(entity.name);
    }
  }

  if (failures.length) {
    throw new Error(`Import stopped without changing pages.json. Failed pages: ${failures.join(", ")}`);
  }

  const timeline = content.timelines?.[0];
  if (timeline) {
    const body = timelineMarkdown(timeline, entityNames);
    pages.push({
      id: timeline.id,
      name: timeline.name || timeline.data?.name || "La historia de Breugaire",
      type: "History",
      aliases: ["Timeline", "Historia"],
      banner: timeline.data?.events?.find((event) => event.imageUrl)?.imageUrl || content.world.avatar,
      summary: summaryFromMarkdown(body, "The published history of Breugaire."),
      body,
      source: SOURCE_URL,
      imported: true,
    });
  }

  const map = content.maps?.[0];
  if (map) {
    pages.push({
      id: map.id,
      name: map.name || "Mapa de Breugaire",
      type: "Map",
      aliases: ["World map", "Mapa"],
      banner: map.backgroundUrl || content.world.avatar,
      summary: "The published world map of Breugaire.",
      body: `## World map\n\n![${map.name || "Mapa de Breugaire"}](${map.backgroundUrl})`,
      source: SOURCE_URL,
      imported: true,
    });
  }

  const tree = content.familyTrees?.[0] || content.familyTree;
  if (tree) {
    const body = familyTreeMarkdown(tree);
    pages.push({
      id: tree.id,
      name: tree.name || "Von Bloodingtons",
      type: "Family Tree",
      aliases: ["Árbol genealógico"],
      banner: content.entities.find((entity) => entity.name.includes("von Bloodington"))?.banner || content.world.avatar,
      summary: "The published Von Bloodington family tree.",
      body,
      source: SOURCE_URL,
      imported: true,
    });
  }

  if (!dryRun) writeJSON(OUTPUT_PATH, normalizeWikiPages(pages), true);
  console.log(dryRun ? `Dry run passed with ${pages.length} pages; pages.json was not changed` : `Wrote ${pages.length} pages to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
