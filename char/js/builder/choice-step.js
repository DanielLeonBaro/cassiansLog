// Renders accessible catalog-driven Class, Background, and Species/Race steps.
import { escapeAttribute, escapeHTML } from "../../../shared/js/text.js";
import {
  BUILDER_CERTIFIED_LEVELS,
  builderRootEntries,
  builderStepEvaluation,
  builderSubclassLevel,
} from "./choice-model.js";
import { renderCharacterBuilderSpells } from "./spells.js";

const stepCopy = {
  class: { label: "Class", verb: "Choose a class" },
  background: { label: "Background", verb: "Choose a background" },
  species: { label: "Species/Race", verb: "Choose a species or race" },
};

const unavailableReasons = {
  "level-gated": "Available at a higher level.",
  "prerequisite-unmet": "Prerequisite not met.",
  "prerequisite-unsupported": "Prerequisite needs manual review.",
  "requirements-unmet": "Required choice not active.",
  "requirements-unsupported": "Requirements need manual review.",
  "ruleset-mismatch": "Not available in this ruleset.",
  "source-unavailable": "Its source is not enabled.",
  "unresolved-reference": "The referenced Compendium entry is missing.",
};

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function selectedEntry(entries, id) {
  return entries.find((entry) => entry.id === id || entry.originalId === id) || null;
}

function selected(value, current) {
  return value === current ? " selected" : "";
}

function checked(value) {
  return value ? " checked" : "";
}

function entryOption(entry, current) {
  const publication = text(entry.publication || entry.source);
  const coverage = text(entry.automation?.status) || "manual";
  const label = [entry.name || entry.id, publication, coverage].filter(Boolean).join(" — ");
  return `<option value="${escapeAttribute(entry.id)}"${selected(entry.id, current)}>${escapeHTML(label)}</option>`;
}

function coverageNotice(entry) {
  if (!entry) return "";
  const status = text(entry.automation?.status) || "manual";
  const source = text(entry.publication || entry.source) || "Unknown source";
  const safeStatus = status === "rules-ready" ? "Rules-ready" : status === "partial" ? "Partial automation" : "Manual automation";
  const warning = status === "rules-ready"
    ? "Automatic effects use the reviewed Compendium rules."
    : "This option remains selectable, but Cassian’s Log will not guess missing rule effects.";
  return `<div class="rounded-xl border ${status === "rules-ready" ? "border-green-600/30 bg-green-500/10" : "border-amber-600/40 bg-amber-500/10"} p-3 text-sm" data-builder-coverage="${escapeAttribute(status)}"><strong>${escapeHTML(entry.name || entry.id)}</strong><span class="ml-2 text-xs font-bold uppercase tracking-wide">${escapeHTML(safeStatus)}</span><p class="mt-1 text-xs">${escapeHTML(source)}. ${escapeHTML(warning)}</p></div>`;
}

function rootSelector(kind, entries, current, disabled) {
  const copy = stepCopy[kind];
  return `<label for="builder-${kind}-choice" class="block"><span class="mb-1 block text-sm font-bold">${copy.verb}</span><select id="builder-${kind}-choice" class="w-full rounded-xl border border-stone-300 bg-white/80 px-3 py-2.5 text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold dark:border-white/15 dark:bg-ink dark:text-white"${disabled ? " disabled" : ""}><option value="">${copy.verb}…</option>${entries.map((entry) => entryOption(entry, current)).join("")}</select></label>`;
}

function choiceStatus(choice) {
  if (choice.status === "complete") return "Complete";
  if (choice.status === "invalid") return "Invalid selection";
  if (choice.status === "unavailable") return unavailableReasons[choice.unavailableReason] || "Unavailable";
  return `Choose ${choice.minimum}`;
}

function ruleChoice(choice, index, disabled) {
  if (choice.status === "unavailable") return "";
  const selectedIds = new Set(choice.selectedIds);
  const atLimit = selectedIds.size >= choice.maximum;
  const inputType = choice.maximum === 1 ? "radio" : "checkbox";
  const descriptionId = `builder-rule-choice-${index}-description`;
  const options = choice.options.map((option, optionIndex) => {
    const isSelected = selectedIds.has(option.id);
    const isDisabled = disabled || !option.available || (inputType === "checkbox" && atLimit && !isSelected);
    const reason = option.available ? "" : unavailableReasons[option.unavailableReason] || "Unavailable for this build.";
    const manual = ["partial", "manual"].includes(option.automation)
      ? " Automatic effects are incomplete."
      : "";
    return `<label class="flex gap-3 rounded-xl border border-stone-300 p-3 has-[:checked]:border-blood-500 has-[:checked]:ring-1 has-[:checked]:ring-blood-500 dark:border-white/15 ${isDisabled ? "opacity-60" : ""}"><input id="builder-rule-choice-${index}-${optionIndex}" type="${inputType}" name="builder-rule-choice-${index}" value="${escapeAttribute(option.id)}" data-builder-choice-key="${escapeAttribute(choice.key)}" class="mt-1 h-4 w-4 accent-red-700"${checked(isSelected)}${isDisabled ? " disabled" : ""}><span><strong class="block text-sm">${escapeHTML(option.label || option.id)}</strong>${reason || manual ? `<span class="block text-xs text-stone-500 dark:text-stone-400">${escapeHTML(`${reason}${manual}`.trim())}</span>` : ""}</span></label>`;
  }).join("");
  return `<fieldset class="grid gap-3 rounded-2xl border border-stone-300/80 p-4 dark:border-white/15" data-builder-rule-choice="${escapeAttribute(choice.key)}" data-builder-choice-state="${escapeAttribute(choice.status)}" data-builder-choice-minimum="${choice.minimum}" data-builder-choice-maximum="${choice.maximum}"${disabled ? " disabled" : ""}><legend class="px-1 font-display text-lg font-bold">${escapeHTML(choice.name)}</legend><p id="${descriptionId}" class="text-xs text-stone-500 dark:text-stone-400">${escapeHTML(choice.minimum === choice.maximum ? `Choose ${choice.minimum}.` : `Choose ${choice.minimum} to ${choice.maximum}.`)} <strong>${escapeHTML(choiceStatus(choice))}</strong></p><div class="grid gap-2 sm:grid-cols-2" aria-describedby="${descriptionId}">${options || '<p class="text-sm text-amber-700 dark:text-amber-300">No resolvable options are available.</p>'}</div></fieldset>`;
}

function warningList(warnings, selectedRoots) {
  const embedded = selectedRoots.flatMap((entry) => Array.isArray(entry?.rules?.warnings) ? entry.rules.warnings : []);
  const merged = [...warnings, ...embedded].filter((warning, index, all) => (
    warning?.message && all.findIndex((candidate) => candidate?.code === warning.code && candidate?.message === warning.message) === index
  ));
  if (!merged.length) return "";
  return `<section class="rounded-2xl border border-amber-600/40 bg-amber-500/10 p-4" aria-labelledby="builder-choice-warnings-title"><h4 id="builder-choice-warnings-title" class="font-display text-lg font-bold">Review notices</h4><ul class="mt-2 list-disc space-y-1 pl-5 text-sm">${merged.map((warning) => `<li>${escapeHTML(warning.message)}</li>`).join("")}</ul></section>`;
}

export function renderCharacterBuilderChoiceStep(container, {
  step,
  document,
  entries = [],
  loading = false,
  error = "",
  disabled = false,
  onRootChange,
  onLevelChange,
  onSubclassChange,
  onRuleChoiceChange,
  onSpellChange,
} = {}) {
  const copy = stepCopy[step];
  if (!copy) return null;
  if (loading || error) {
    container.innerHTML = `<p class="rounded-xl border ${error ? "border-amber-600/40 bg-amber-500/10" : "border-sky-600/30 bg-sky-500/10"} p-4 text-sm" role="status" aria-live="polite">${escapeHTML(error || `Loading ${copy.label} choices…`)}</p>`;
    return null;
  }

  const roots = builderRootEntries(entries, document, step);
  const currentId = step === "class" ? document.build.levels[0]?.classId || "" : document.build[step === "species" ? "speciesId" : "backgroundId"];
  const root = selectedEntry(entries, currentId);
  const detail = builderStepEvaluation(document, entries, step);
  const level = document.build.levels[0]?.level || 1;
  const subclassLevel = step === "class" ? builderSubclassLevel(document, entries) : 0;
  const subclassId = document.build.levels[0]?.subclassId || "";
  const subclasses = step === "class" ? builderRootEntries(entries, document, "subclass") : [];
  const subclass = selectedEntry(entries, subclassId);
  const rootFilterMessage = roots.length
    ? `${roots.length.toLocaleString()} compatible ${copy.label.toLocaleLowerCase()} option${roots.length === 1 ? "" : "s"}.`
    : `No ${copy.label.toLocaleLowerCase()} options match the Home content filters.`;

  container.innerHTML = `<div id="character-builder-${step}" class="grid gap-5">
    <section class="grid gap-4" aria-labelledby="builder-${step}-selection-title">
      <div><h4 id="builder-${step}-selection-title" class="font-display text-lg font-bold">${escapeHTML(copy.label)} selection</h4><p class="mt-1 text-xs text-stone-500 dark:text-stone-400">${escapeHTML(rootFilterMessage)} Change filters on Home to adjust this list.</p></div>
      ${rootSelector(step, roots, currentId, disabled)}
      ${coverageNotice(root)}
      ${step === "class" && root ? `<div class="grid gap-3 sm:grid-cols-2"><label for="builder-class-level"><span class="mb-1 block text-sm font-bold">Class level</span><select id="builder-class-level" class="w-full rounded-xl border border-stone-300 bg-white/80 px-3 py-2.5 text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold dark:border-white/15 dark:bg-ink dark:text-white"${disabled ? " disabled" : ""}>${BUILDER_CERTIFIED_LEVELS.map((candidate) => `<option value="${candidate}"${selected(candidate, level)}>Level ${candidate}</option>`).join("")}</select><span class="mt-1 block text-xs text-stone-500 dark:text-stone-400">Current certified builder slice: levels 1–5.</span></label>${subclassLevel && level >= subclassLevel ? `<label for="builder-subclass-choice"><span class="mb-1 block text-sm font-bold">Subclass</span><select id="builder-subclass-choice" class="w-full rounded-xl border border-stone-300 bg-white/80 px-3 py-2.5 text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold dark:border-white/15 dark:bg-ink dark:text-white"${disabled ? " disabled" : ""}><option value="">Choose a subclass…</option>${subclasses.map((entry) => entryOption(entry, subclassId)).join("")}</select><span class="mt-1 block text-xs text-stone-500 dark:text-stone-400">Required from level ${subclassLevel}. Only subclasses linked to ${escapeHTML(root.name || root.id)} are shown.</span></label>` : ""}</div>${coverageNotice(subclass)}` : ""}
    </section>
    ${detail.choices.length ? `<section class="grid gap-4" aria-labelledby="builder-${step}-choices-title"><div><h4 id="builder-${step}-choices-title" class="font-display text-lg font-bold">Required choices</h4><p class="mt-1 text-xs text-stone-500 dark:text-stone-400">Counts, level gates, duplicates, and prerequisites are enforced by the rules evaluator.</p></div>${detail.choices.map((choice, index) => ruleChoice(choice, index, disabled)).join("")}</section>` : ""}
    ${step === "class" ? '<div id="builder-spell-repertoire"></div>' : ""}
    ${warningList(detail.warnings, [root, subclass].filter(Boolean))}
  </div>`;

  container.querySelector(`#builder-${step}-choice`)?.addEventListener("change", (event) => onRootChange?.(step, event.target.value, event.target.id));
  container.querySelector("#builder-class-level")?.addEventListener("change", (event) => onLevelChange?.(event.target.value, event.target.id));
  container.querySelector("#builder-subclass-choice")?.addEventListener("change", (event) => onSubclassChange?.(event.target.value, event.target.id));
  container.querySelectorAll("[data-builder-choice-key]").forEach((control) => control.addEventListener("change", () => {
    const key = control.dataset.builderChoiceKey;
    const fieldset = control.closest("[data-builder-rule-choice]");
    const values = [...fieldset.querySelectorAll("[data-builder-choice-key]:checked")].map(({ value }) => value);
    onRuleChoiceChange?.(key, values, control.id);
  }));
  const spells = step === "class" ? renderCharacterBuilderSpells(container.querySelector("#builder-spell-repertoire"), {
    document,
    entries,
    disabled,
    onChange: onSpellChange,
  }) : null;
  return { ...detail, spells };
}
