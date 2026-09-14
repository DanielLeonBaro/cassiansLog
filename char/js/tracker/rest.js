// Applies short-rest, long-rest, turn, and manual reset rules to character resources.
function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function getRestDetails(character, items, slots, kind) {
  const long = kind === "long";
  if (!long && kind !== "short") throw new Error("Unknown rest type.");
  const rulesAware = character.build?.mode === "rules";
  const restoresOnRest = (reset = "long") => {
    if (!rulesAware) return long || reset === "short";
    return long ? ["short", "long", "day"].includes(reset) : reset === "short";
  };
  const resources = items.filter((item) =>
    Boolean(item.uses) && restoresOnRest(item.uses.reset),
  );
  const restoredSlots = slots.filter((slot) =>
    restoresOnRest(slot.reset),
  );
  const title = long ? "Long rest" : "Short rest";
  const ruleset = character.build?.ruleset === "5.5e" ? "5.5e" : "5e";
  const resourceCount = plural(resources.length, "resource");
  const slotCount = plural(restoredSlots.length, "spell-slot group");
  const effects = [
    resources.length
      ? `${resourceCount} return to full uses: ${resources.map((item) => item.name).join(", ")}.`
      : `No ${long ? "rest" : "short-rest"} resources need restoring.`,
    restoredSlots.length
      ? `${slotCount} return to full uses.`
      : "No spell-slot groups are restored.",
    long
      ? `Current HP returns to ${character.hp.max}, and temporary HP is cleared.`
      : rulesAware
        ? "Current and temporary HP do not change; hit dice can be spent separately."
        : "Temporary HP is cleared. Current HP does not change.",
    long || !rulesAware
      ? "Death saving throws and Stable are reset."
      : "Death saving throws and Stable do not change.",
  ];
  if (rulesAware && long) effects.push(ruleset === "5.5e"
    ? "All spent hit dice return."
    : "Spent hit dice return up to half the character level; multiclass pools use displayed order until choice UI is added.");
  return {
    kind,
    title,
    duration: long ? "At least 8 hours" : "At least 1 hour",
    description: long
      ? "A long rest restores the character for the next adventuring day."
      : "A short rest restores features that recharge after a short rest.",
    effects,
    toast: rulesAware
      ? `${title} complete. ${resourceCount} and ${slotCount} restored${long ? "; HP, hit dice, and eligible effects updated" : ""}.`
      : `${title} complete. ${resourceCount} and ${slotCount} restored; ${long ? "HP, temporary HP," : "temporary HP"} and death saves reset.`,
  };
}
