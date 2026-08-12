function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function getRestDetails(character, items, slots, kind) {
  const long = kind === "long";
  if (!long && kind !== "short") throw new Error("Unknown rest type.");
  const resources = items.filter((item) =>
    long ? Boolean(item.uses) : item.uses?.reset === "short",
  );
  const restoredSlots = slots.filter((slot) =>
    long ? true : (slot.reset || "long") === "short",
  );
  const title = long ? "Long rest" : "Short rest";
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
      : "Temporary HP is cleared. Current HP does not change.",
    "Death saving throws and Stable are reset.",
  ];
  return {
    kind,
    title,
    duration: long ? "At least 8 hours" : "At least 1 hour",
    description: long
      ? "A long rest restores the character for the next adventuring day."
      : "A short rest restores features that recharge after a short rest.",
    effects,
    toast: `${title} complete. ${resourceCount} and ${slotCount} restored; ${long ? "HP, temporary HP," : "temporary HP"} and death saves reset.`,
  };
}
