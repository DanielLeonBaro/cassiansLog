import { renderRichText } from "../../shared/js/rich-text.js";
import { escapeAttribute, escapeHTML } from "../../shared/js/text.js";

export const widgetLabels = {
  character: "Character Quick Info",
  party: "Party Overview",
  manual: "Manual Reference",
  compendium: "Compendium Reference",
  note: "Note",
  initiative: "Public Initiative",
  calculator: "Calculator",
};

const abilityLabels = { str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA" };
const fieldClass = "w-full rounded-xl border border-stone-300 bg-white/80 px-3 py-2.5 text-stone-900 outline-none focus:border-blood-500 focus:ring-2 focus:ring-blood-500/20 dark:border-white/15 dark:bg-white/5 dark:text-white";

function safeURL(value) {
  return /^https?:\/\/\S+$/i.test(value || "") ? value : "";
}

function mentionRenderer(pageByName) {
  return {
    imageAttribute: "data-screen-image",
    resolveMention(name, label) {
      const page = pageByName(name);
      return page
        ? `<a href="/wiki/${encodeURIComponent(page.id)}" class="wiki-mention">${escapeHTML(label)}</a>`
        : null;
    },
  };
}

export function renderScreenRichText(body, pageByName) {
  return renderRichText(body, mentionRenderer(pageByName));
}

function cardControls(widget, index, total) {
  return `<div class="flex shrink-0 items-center gap-1">
    <button type="button" data-move-widget="-1" ${index === 0 ? "disabled" : ""} class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-200 disabled:opacity-30 dark:hover:bg-white/10" aria-label="Move ${escapeAttribute(widgetLabels[widget.type])} earlier"><i class="bi bi-arrow-left"></i></button>
    <button type="button" data-move-widget="1" ${index === total - 1 ? "disabled" : ""} class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-200 disabled:opacity-30 dark:hover:bg-white/10" aria-label="Move ${escapeAttribute(widgetLabels[widget.type])} later"><i class="bi bi-arrow-right"></i></button>
    <button type="button" data-edit-widget class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-sky-600 hover:bg-sky-600/10" aria-label="Edit ${escapeAttribute(widgetLabels[widget.type])}"><i class="bi bi-pencil-fill"></i></button>
    <button type="button" data-remove-widget class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-danger-500 hover:bg-danger-500/10" aria-label="Remove ${escapeAttribute(widgetLabels[widget.type])}"><i class="bi bi-trash-fill"></i></button>
  </div>`;
}

function shell(widget, index, total, title, icon, body, footer = "") {
  return `<article data-widget-id="${escapeAttribute(widget.id)}" class="group flex min-h-72 flex-col overflow-hidden rounded-2xl border border-stone-300/80 bg-white/75 shadow-card backdrop-blur-sm transition dark:border-white/10 dark:bg-white/[.055]">
    <header draggable="true" data-widget-drag class="flex cursor-grab items-start justify-between gap-2 border-b border-stone-200/80 bg-stone-100/70 px-4 py-3 active:cursor-grabbing dark:border-white/10 dark:bg-white/[.045]" title="Drag to reorder">
      <div class="min-w-0"><p class="text-[.65rem] font-bold uppercase tracking-[.16em] text-blood-500"><i class="bi ${icon} mr-1"></i>${escapeHTML(widgetLabels[widget.type])}</p><h2 class="mt-1 truncate font-display text-xl font-bold">${escapeHTML(title)}</h2></div>
      ${cardControls(widget, index, total)}
    </header>
    <div class="flex grow flex-col p-4">${body}</div>
    ${footer ? `<footer class="flex flex-wrap gap-2 border-t border-stone-200/80 p-4 dark:border-white/10">${footer}</footer>` : ""}
  </article>`;
}

function characterClass(character) {
  return [character?.class, character?.subclass].filter(Boolean).join(" · ") || "No class";
}

function abilityGrid(character, selected = Object.keys(abilityLabels)) {
  return `<dl class="grid grid-cols-3 gap-2">${selected.map((ability) => `<div class="rounded-xl bg-stone-100/80 p-2 text-center dark:bg-white/5"><dt class="text-[.65rem] font-bold text-stone-500">${abilityLabels[ability]}</dt><dd class="font-display text-lg font-bold">${escapeHTML(character?.stats?.[ability]?.score ?? "—")}</dd></div>`).join("")}</dl>`;
}

function characterSummary(character) {
  if (!character) return '<p class="grow py-8 text-center text-sm text-stone-500">This character is unavailable. Edit the card to choose another.</p>';
  return `<div class="flex items-center gap-3">
    <img src="${escapeAttribute(character.portrait || "shared/assets/bat.ico")}" alt="" class="h-16 w-16 rounded-xl border border-stone-300 object-cover dark:border-white/15">
    <div class="min-w-0"><p class="font-display text-lg font-bold">${escapeHTML(character.name)}</p><p class="text-sm text-stone-500 dark:text-stone-400">Level ${escapeHTML(character.level ?? "—")} · ${escapeHTML(characterClass(character))}</p></div>
  </div>
  <div class="my-4 grid grid-cols-2 gap-2"><div class="rounded-xl bg-blood-500/10 p-3"><small class="block font-bold text-blood-500">HP</small><strong>${escapeHTML(character.hp?.current ?? "—")} / ${escapeHTML(character.hp?.max ?? "—")}</strong></div><div class="rounded-xl bg-gold/10 p-3"><small class="block font-bold text-stone-500">AC</small><strong>${escapeHTML(character.ac ?? "—")}</strong></div></div>
  ${abilityGrid(character)}`;
}

function partyMember(character, fields) {
  if (!character) return "";
  const abilities = [...fields].filter((field) => abilityLabels[field]);
  return `<li class="rounded-xl border border-stone-200 p-3 dark:border-white/10">
    <div class="flex items-center gap-3">${fields.includes("portrait") ? `<img src="${escapeAttribute(character.portrait || "shared/assets/bat.ico")}" alt="" class="h-11 w-11 rounded-lg object-cover">` : ""}<div class="min-w-0 grow"><a href="char/${encodeURIComponent(character.id)}/" class="font-display font-bold hover:text-blood-500">${escapeHTML(character.name)}</a>${fields.includes("classLevel") ? `<p class="text-xs text-stone-500">Level ${escapeHTML(character.level ?? "—")} · ${escapeHTML(characterClass(character))}</p>` : ""}</div>${fields.includes("hp") ? `<span class="text-sm"><strong>${escapeHTML(character.hp?.current ?? "—")}</strong>/${escapeHTML(character.hp?.max ?? "—")} HP</span>` : ""}${fields.includes("ac") ? `<span class="rounded-lg bg-gold/10 px-2 py-1 text-sm font-bold">AC ${escapeHTML(character.ac ?? "—")}</span>` : ""}</div>
    ${abilities.length ? `<div class="mt-3">${abilityGrid(character, abilities)}</div>` : ""}
  </li>`;
}

function textWidgetBody(widget, pageByName) {
  const source = widget.type === "manual" && widget.sourceLabel
    ? `<p class="mb-3 text-xs text-stone-500">Source: ${safeURL(widget.sourceUrl) ? `<a class="font-bold text-blood-500 hover:underline" href="${escapeAttribute(widget.sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHTML(widget.sourceLabel)}</a>` : escapeHTML(widget.sourceLabel)}</p>`
    : widget.type === "compendium" && widget.source?.publication
      ? `<p class="mb-3 text-xs text-stone-500">${escapeHTML(widget.source.publication)}</p>` : "";
  return `${widget.image ? `<img src="${escapeAttribute(widget.image)}" alt="${escapeAttribute(widget.title)}" data-screen-image role="button" tabindex="0" class="mb-4 h-40 w-full cursor-zoom-in rounded-xl object-cover" aria-label="View ${escapeAttribute(widget.title || "reference")} image full size">` : ""}${source}<div class="wiki-rich max-h-56 grow overflow-hidden text-sm">${widget.body ? renderScreenRichText(widget.body, pageByName) : '<p class="text-stone-500">No content yet.</p>'}</div>`;
}

export function calculatorKeypad(widget) {
  const keys = ["C", "(", ")", "⌫", "7", "8", "9", "/", "4", "5", "6", "*", "1", "2", "3", "-", "0", ".", "=", "+"];
  return `<div data-calculator="${escapeAttribute(widget.id)}">
    <label class="sr-only" for="calculator-${escapeAttribute(widget.id)}">Calculation</label>
    <input id="calculator-${escapeAttribute(widget.id)}" data-calculator-expression value="${escapeAttribute(widget.expression || "")}" inputmode="decimal" autocomplete="off" spellcheck="false" class="${fieldClass} text-right font-mono text-lg" placeholder="1+3/2(3+2)">
    <p data-calculator-error class="mt-2 hidden text-sm text-danger-500" role="alert"></p>
    <div class="mt-3 grid grid-cols-4 gap-2">${keys.map((key) => `<button type="button" data-calculator-key="${escapeAttribute(key)}" class="rounded-xl border px-3 py-2 font-bold ${key === "=" ? "border-blood-500 bg-blood-500 text-white" : "border-stone-300 hover:border-blood-500 hover:text-blood-500 dark:border-white/15"}">${escapeHTML(key)}</button>`).join("")}</div>
  </div>`;
}

export function renderWidgetCard(widget, index, total, context) {
  const characterMap = context.characterMap;
  if (widget.type === "character") {
    const character = characterMap.get(widget.characterId);
    return shell(widget, index, total, character?.name || "Character unavailable", "bi-person-vcard-fill", characterSummary(character), character ? `<a href="char/${encodeURIComponent(character.id)}/" class="inline-flex grow items-center justify-center gap-2 rounded-xl bg-blood-500 px-4 py-2 text-sm font-bold text-white">Open tracker <i class="bi bi-arrow-right"></i></a>` : "");
  }
  if (widget.type === "party") {
    const characters = widget.characterIds.map((id) => characterMap.get(id)).filter(Boolean);
    const body = characters.length ? `<ul class="max-h-72 space-y-2 overflow-y-auto">${characters.map((character) => partyMember(character, widget.fields)).join("")}</ul>` : '<p class="grow py-8 text-center text-sm text-stone-500">No available party members selected.</p>';
    return shell(widget, index, total, "Party", "bi-people-fill", body, `<button type="button" data-view-widget class="inline-flex grow items-center justify-center gap-2 rounded-xl border border-blood-500 px-4 py-2 text-sm font-bold text-blood-500">View all <i class="bi bi-arrows-fullscreen"></i></button>`);
  }
  if (["manual", "compendium", "note"].includes(widget.type)) {
    const icons = { manual: "bi-journal-text", compendium: "bi-journals", note: "bi-sticky-fill" };
    return shell(widget, index, total, widget.title || widgetLabels[widget.type], icons[widget.type], textWidgetBody(widget, context.pageByName), `<button type="button" data-view-widget class="inline-flex grow items-center justify-center gap-2 rounded-xl border border-blood-500 px-4 py-2 text-sm font-bold text-blood-500">View more <i class="bi bi-arrows-fullscreen"></i></button>`);
  }
  if (widget.type === "initiative") {
    const names = context.initiative;
    const body = names.length ? `<ol class="space-y-2">${names.map((name, itemIndex) => `<li class="flex items-center gap-3 rounded-xl border border-stone-200 px-3 py-2 dark:border-white/10"><span class="flex h-7 w-7 items-center justify-center rounded-full bg-blood-500 text-xs font-bold text-white">${itemIndex + 1}</span><strong>${escapeHTML(name)}</strong></li>`).join("")}</ol>` : '<p class="grow py-8 text-center text-sm text-stone-500">No initiative entries yet.</p>';
    const combat = context.kind === "dm" && context.roles.includes("combat-loot") ? '<a href="combat-loot/" class="inline-flex grow items-center justify-center rounded-xl border border-sky-600 px-3 py-2 text-sm font-bold text-sky-600">Combat & Loot</a>' : "";
    return shell(widget, index, total, "Initiative Order", "bi-list-ol", body, `<a href="public-initiative/" class="inline-flex grow items-center justify-center rounded-xl bg-blood-500 px-3 py-2 text-sm font-bold text-white">Public Initiative</a>${combat}`);
  }
  return shell(widget, index, total, "Calculator", "bi-calculator-fill", calculatorKeypad(widget), `<button type="button" data-view-widget class="inline-flex grow items-center justify-center gap-2 rounded-xl border border-blood-500 px-4 py-2 text-sm font-bold text-blood-500">History <i class="bi bi-clock-history"></i></button>`);
}

export function renderPartyDetail(widget, characterMap) {
  const characters = widget.characterIds.map((id) => characterMap.get(id)).filter(Boolean);
  return `<ul class="space-y-3">${characters.map((character) => partyMember(character, widget.fields)).join("") || '<li class="text-stone-500">No available party members.</li>'}</ul>`;
}

export function editorFields(widget, characters, roles) {
  const options = characters.map((character) => `<option value="${escapeAttribute(character.id)}"${character.id === widget.characterId ? " selected" : ""}>${escapeHTML(character.name)}</option>`).join("");
  if (widget.type === "character") return `<label class="block"><span class="mb-1 block text-sm font-bold">Character</span><select name="characterId" required class="${fieldClass}"><option value="">Choose a character</option>${options}</select></label>`;
  if (widget.type === "party") {
    const selected = new Set(widget.characterIds);
    const fields = [
      ["portrait", "Portrait"], ["classLevel", "Class and level"], ["hp", "Current / max HP"], ["ac", "Armor class"],
      ...Object.entries(abilityLabels).map(([id, label]) => [id, label]),
    ];
    return `<fieldset><legend class="mb-2 text-sm font-bold">Party members</legend><div class="grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2">${characters.map((character) => `<label class="flex items-center gap-2 rounded-xl border border-stone-300 px-3 py-2 dark:border-white/15"><input type="checkbox" name="characterIds" value="${escapeAttribute(character.id)}"${selected.has(character.id) ? " checked" : ""} class="accent-red-700">${escapeHTML(character.name)}</label>`).join("")}</div></fieldset><fieldset><legend class="mb-2 text-sm font-bold">Fields shown for every member</legend><div class="grid gap-2 sm:grid-cols-2">${fields.map(([id, label]) => `<label class="flex items-center gap-2 rounded-xl border border-stone-300 px-3 py-2 dark:border-white/15"><input type="checkbox" name="partyFields" value="${id}"${widget.fields.includes(id) ? " checked" : ""} class="accent-red-700">${label}</label>`).join("")}</div></fieldset>`;
  }
  if (widget.type === "initiative") return '<p class="rounded-xl border border-stone-300 bg-stone-100/70 p-4 text-sm text-stone-500 dark:border-white/15 dark:bg-white/5">This card is read-only. Use its links to open the full tracker.</p>';
  if (widget.type === "calculator") return '<p class="rounded-xl border border-stone-300 bg-stone-100/70 p-4 text-sm text-stone-500 dark:border-white/15 dark:bg-white/5">Calculation history belongs to this card and remains until cleared.</p>';
  const image = widget.type !== "note" ? `<div class="grid gap-3 sm:grid-cols-[1fr_auto]"><label><span class="mb-1 block text-sm font-bold">Image URL</span><input name="image" type="url" value="${escapeAttribute(widget.image?.startsWith("data:") ? "" : widget.image || "")}" class="${fieldClass}" placeholder="https://…"></label><label class="self-end"><span class="mb-1 block text-sm font-bold">Or upload</span><input name="imageUpload" type="file" accept="image/*" class="block max-w-64 text-sm"></label></div><input name="storedImage" type="hidden" value="${escapeAttribute(widget.image?.startsWith("data:") ? widget.image : "")}"><button type="button" data-clear-editor-image class="text-left text-sm font-bold text-blood-500">Remove image</button>` : "";
  const source = widget.type === "manual" ? `<div class="grid gap-3 sm:grid-cols-2"><label><span class="mb-1 block text-sm font-bold">Source label</span><input name="sourceLabel" value="${escapeAttribute(widget.sourceLabel || "")}" maxlength="160" class="${fieldClass}"></label><label><span class="mb-1 block text-sm font-bold">Source URL</span><input name="sourceUrl" type="url" value="${escapeAttribute(widget.sourceUrl || "")}" class="${fieldClass}" placeholder="https://…"></label></div>` : "";
  const compendium = widget.type === "compendium" ? `<div class="rounded-xl border border-sky-600/30 bg-sky-600/10 p-4"><p class="text-sm">${widget.source?.id ? `Copied from <strong>${escapeHTML(widget.source.name)}</strong> · ${escapeHTML(widget.source.publication)}` : "No Compendium entry selected."}</p><button type="button" data-open-compendium class="mt-3 rounded-xl border border-sky-600 px-3 py-2 text-sm font-bold text-sky-600"><i class="bi bi-journals mr-1"></i>${widget.source?.id ? "Choose another entry" : "Choose from Compendium"}</button></div><input name="sourceId" type="hidden" value="${escapeAttribute(widget.source?.id || "")}"><input name="sourceCategory" type="hidden" value="${escapeAttribute(widget.source?.category || "")}"><input name="sourceName" type="hidden" value="${escapeAttribute(widget.source?.name || "")}"><input name="sourcePublication" type="hidden" value="${escapeAttribute(widget.source?.publication || "")}">` : "";
  return `${compendium}<label><span class="mb-1 block text-sm font-bold">Title</span><input name="title" required maxlength="120" value="${escapeAttribute(widget.title || "")}" class="${fieldClass}"></label>${source}${image}<label><span class="mb-1 block text-sm font-bold">Formatted content</span><textarea name="body" rows="14" class="${fieldClass} min-h-72 font-mono text-sm" placeholder="## Heading\n\nUse **bold**, *italic*, lists, links, images, and [[Wiki mentions]].">${escapeHTML(widget.body || "")}</textarea></label>${formattingGuide()}`;
}

export function formattingGuide() {
  return '<details class="rounded-xl border border-stone-300 p-3 text-sm dark:border-white/15"><summary class="cursor-pointer font-bold"><i class="bi bi-markdown mr-2 text-blood-500"></i>Formatting guide</summary><div class="mt-3 grid gap-2 text-xs text-stone-500 sm:grid-cols-2"><code>## Heading</code><code>**bold** and *italic*</code><code>- Bulleted item</code><code>1. Numbered item</code><code>&gt; Quote</code><code>[Link](https://…)</code><code>![Image](https://…)</code><code>[[Wiki page|label]]</code></div></details>';
}

export function fieldClassName() { return fieldClass; }
