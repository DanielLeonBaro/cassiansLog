const fs = require("node:fs");
const path = require("node:path");
const Y = require("yjs");
const { writeWikiSeed } = require("./shared/output.cjs");

const SOURCE_URL = "https://apotheosisoftherings.vvd.world";
const OUTPUT_PATH = path.join(__dirname, "..", "data", "wiki-pages.js");
const MEDIA_BASE = "https://vvd-public-media.zied-8e7.workers.dev";

function flightStrings(html) {
  const expression = /<script>self\.__next_f\.push\(\[1,("(?:\\.|[^"\\])*")\]\)<\/script>/g;
  return [...html.matchAll(expression)].map((match) => JSON.parse(match[1]));
}

function extractBalancedObject(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error(`Could not find ${marker}`);
  const start = source.indexOf("{", markerIndex);
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
  throw new Error(`Could not parse ${marker}`);
}

function getPublishedContent(html) {
  const payload = flightStrings(html).join("\n");
  return extractBalancedObject(payload, '"content":{"maps":');
}

function getEntityUpdate(html) {
  const expression = /<script>self\.__next_f\.push\(\[1,"([A-Za-z0-9+/=]{1000,})"\]\)<\/script>/g;
  const candidates = [...html.matchAll(expression)].map((match) => match[1]);
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0] ? Buffer.from(candidates[0], "base64") : null;
}

function decodeEntityDocument(update) {
  if (!update) return null;
  const discovery = new Y.Doc();
  Y.applyUpdate(discovery, update);
  const keys = [...discovery.share.keys()];
  discovery.destroy();

  const document = new Y.Doc();
  keys.forEach((key) => {
    if (key === "default" || key.startsWith("textblock-")) document.getXmlFragment(key);
    else document.getMap(key);
  });
  Y.applyUpdate(document, update);

  const root = document.getXmlFragment("default");
  const body = root.toArray().find((node) => node.nodeName === "contentBody");
  const header = root.toArray().find((node) => node.nodeName === "cardHeader");
  const result = {
    sections: body?.getAttribute("sections") || [],
    header: header?.getAttributes() || {},
  };
  document.destroy();
  return result;
}

function applyMarks(text, marks = []) {
  let value = text || "";
  if (marks.some((mark) => mark.type === "bold")) value = `**${value}**`;
  if (marks.some((mark) => mark.type === "italic")) value = `*${value}*`;
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
      const level = Math.min(4, Math.max(2, Number(node.attrs?.level) || 2));
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
        output.push(`![${block.caption || "Campaign artwork"}](${MEDIA_BASE}/${block.mediaId})`);
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
    .replace(/[>*_#`\[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return summary ? `${summary.slice(0, 210).trim()}${summary.length > 210 ? "…" : ""}` : fallback;
}

function timelineMarkdown(timeline, entityNames) {
  const lines = [];
  (timeline.data?.ages || []).forEach((age) => {
    lines.push(`## ${age.label}`, age.description || "", "");
  });
  lines.push("## Events", "");
  (timeline.data?.events || []).forEach((event) => {
    lines.push(`### ${event.label}`);
    if (event.imageUrl) lines.push(`![${event.label}](${event.imageUrl})`);
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
  const nodes = tree?.jsonContent?.nodes || [];
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

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.text();
}

async function main() {
  console.log(`Importing published wiki from ${SOURCE_URL}`);
  const home = await fetchText(`${SOURCE_URL}/`);
  const content = getPublishedContent(home);
  const entityNames = new Map(content.entities.map((entity) => [entity.id, entity.name]));
  const types = typeMap(content);
  const pages = [];

  for (const [index, entity] of content.entities.entries()) {
    process.stdout.write(`[${index + 1}/${content.entities.length}] ${entity.name}... `);
    try {
      const html = await fetchText(`${SOURCE_URL}/wiki/${entity.slug}`);
      const document = decodeEntityDocument(getEntityUpdate(html));
      const body = document ? sectionsToMarkdown(document.sections, entityNames) : "";
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
      pages.push({
        id: entity.id,
        name: entity.name,
        type: types.get(entity.entityTypeId) || "Lore",
        aliases: entity.aliases || [],
        banner: entity.banner || entity.avatar || "",
        summary: "Imported campaign entry.",
        body: "",
        source: `${SOURCE_URL}/wiki/${entity.slug}`,
        imported: true,
      });
    }
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

  writeWikiSeed(OUTPUT_PATH, SOURCE_URL, pages);
  console.log(`Wrote ${pages.length} pages to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
