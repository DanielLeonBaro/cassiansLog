// Renders the live Character Builder summary without mutating or saving the draft.
import { characterBuilderPreviewModel } from "./preview-model.js";

function element(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== "") node.textContent = String(text);
  return node;
}

function detailGroup(label, values, { open = false, warning = false } = {}) {
  const group = element("details", `rounded-xl border p-3 ${warning ? "border-amber-600/40 bg-amber-500/10" : "border-stone-300/80 bg-parchment/60 dark:border-white/10 dark:bg-ink/30"}`);
  group.dataset.previewGroup = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  group.open = open;
  const summary = element("summary", "cursor-pointer text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold", `${label} (${values.length})`);
  const list = element("ul", "mt-2 space-y-1 text-xs leading-relaxed text-stone-600 dark:text-stone-300");
  if (!values.length) list.append(element("li", "italic", "None yet."));
  values.forEach((value) => list.append(element("li", "break-words", value)));
  group.append(summary, list);
  return group;
}

export function renderCharacterBuilderPreview(host, { document: value, entries = [], loading = false, error = "", entityName = "Character" } = {}) {
  if (!host || !value) return false;
  host.replaceChildren();
  host.append(element("p", "text-xs font-bold uppercase tracking-[0.18em] text-blood-500", "Live preview"));
  const title = element("h3", "mt-1 font-display text-xl font-bold", `${entityName} at a glance`);
  title.id = "character-builder-preview-title";
  host.append(title);
  if (loading || error) {
    const status = element("p", "mt-3 text-sm text-stone-600 dark:text-stone-300", error || "Calculating available values…");
    status.setAttribute("role", "status");
    host.append(status);
    return true;
  }

  const model = characterBuilderPreviewModel(value, entries);
  if (entityName === "NPC" && model.identity.name === "Unnamed character") model.identity.name = "Unnamed NPC";
  const identity = element("section", "mt-4 rounded-xl border border-blood-500/25 bg-blood-500/10 p-3");
  identity.dataset.previewGroup = "identity";
  identity.append(
    element("p", "font-display text-lg font-bold", model.identity.name),
    element("p", "mt-1 text-xs text-stone-600 dark:text-stone-300", `Level ${model.identity.level} · ${model.identity.ruleset}`),
    element("p", "mt-1 text-xs text-stone-600 dark:text-stone-300", model.identity.details),
  );
  const metrics = element("dl", "mt-3 grid grid-cols-2 gap-2");
  model.core.forEach(({ label, value: metric }) => {
    const card = element("div", "rounded-lg border border-stone-300/80 bg-white/60 p-2 dark:border-white/10 dark:bg-white/5");
    card.append(element("dt", "text-[0.65rem] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400", label), element("dd", "mt-1 font-display text-lg font-bold", metric));
    metrics.append(card);
  });
  const abilities = model.abilities.map(({ label, score, modifier }) => `${label} ${score} (${modifier})`);
  const groups = [
    ["Abilities", abilities, { open: true }], ["Saves", model.saves], ["Skills", model.skills],
    ["Actions & attacks", model.attacks], ["Spells & slots", model.spells], ["Resources", model.resources],
    ["Proficiencies", model.proficiencies], ["Inventory", model.inventory],
    ["Warnings", model.warnings.map(({ message, impact }) => `${message}${impact ? ` ${impact}` : ""}`), { open: model.warnings.length > 0, warning: true }],
  ];
  const content = element("div", "mt-3 space-y-2");
  groups.forEach(([label, values, options]) => content.append(detailGroup(label, values, options)));
  const status = element("p", "sr-only", "Live character preview updated.");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  host.append(identity, metrics, content, status);
  return true;
}
