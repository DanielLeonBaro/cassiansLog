// Exposes catalog entries plus declarative effects from selected inline choices.
function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function entries(catalog) {
  return Array.isArray(catalog) ? catalog : Array.isArray(catalog?.entries) ? catalog.entries : [];
}

export function activeRuleEntries(graph, catalog) {
  const index = new Map(entries(catalog).filter((entry) => entry?.id).map((entry) => [entry.id, entry]));
  const active = graph.activeEntries.flatMap((record) => {
    const entry = index.get(record.id);
    return entry ? [{ entry, active: record }] : [];
  });

  graph.choices.forEach((choice) => {
    if (choice.status !== "complete") return;
    const selected = new Set(choice.selectedIds || []);
    choice.options.filter((option) => selected.has(option.id) && option.rules).forEach((option) => {
      const id = `${choice.sourceId}:choice:${choice.index}:${option.id}`;
      active.push({
        entry: {
          id,
          originalId: "",
          name: option.label || option.id,
          type: option.type || choice.type || "Choice",
          ruleset: graph.ruleset,
          automation: { status: "rules-ready", reasons: [], expressions: [] },
          rules: option.rules,
          sheet: option.description || "",
          summary: option.description || "",
          sheetAttributes: option.sheetAttributes || {},
        },
        active: {
          id,
          name: option.label || option.id,
          type: option.type || choice.type || "Choice",
          level: choice.level,
          via: "inline-selection",
          sourceId: choice.sourceId,
        },
      });
    });
  });

  return active;
}
