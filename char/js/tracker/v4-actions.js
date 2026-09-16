// Resolves and consumes an explicit V4 action resource without guessing hidden rules.
function text(value) {
  return String(value ?? "").trim();
}

function allItems(character = {}) {
  return [
    ...(character.actions || []),
    ...(character.spells || []),
    ...(character.features || []),
    ...(character.resources || []),
  ];
}

function resourceOption(item) {
  if (!item?.uses) return null;
  const current = Math.max(0, Number(item.uses.current) || 0);
  const max = Math.max(0, Number(item.uses.max) || 0);
  return {
    id: `resource:${item.id}`,
    kind: "resource",
    targetId: item.id,
    label: text(item.name) || "Resource",
    current,
    max,
    reset: text(item.uses.reset) || "manual",
  };
}

function slotOptions(character, item) {
  const minimum = Math.max(1, Number(item?.slotLevel) || Number(item?.level) || 1);
  return (character.spellcasting?.slots || [])
    .filter((slot) => Number(slot.level) >= minimum)
    .filter((slot) => !item?.source || !slot.profileId || slot.profileId === item.source)
    .map((slot) => ({
      id: `slot:${slot.id}`,
      kind: "slot",
      targetId: slot.id,
      label: `Level ${slot.level} spell slot`,
      current: Math.max(0, Number(slot.current) || 0),
      max: Math.max(0, Number(slot.max) || 0),
      reset: text(slot.reset) || "long",
    }));
}

export function planV4ActionUse(character = {}, itemId, selectionId = "") {
  const item = allItems(character).find((candidate) => candidate?.id === itemId);
  if (!item) return {
    item: null,
    name: "Unknown action",
    limited: false,
    options: [],
    selectedId: "",
    canConfirm: false,
    message: "This action is no longer available.",
  };

  let options = [];
  if (item.uses) options = [resourceOption(item)].filter(Boolean);
  else if (text(item.resourceId)) {
    options = [resourceOption(allItems(character).find((candidate) => candidate?.id === item.resourceId))].filter(Boolean);
  } else if (item.slotLevel) {
    options = slotOptions(character, item);
  }
  const limited = Boolean(item.uses || item.resourceId || item.slotLevel);
  const selected = options.find((option) => option.id === selectionId)
    || options.find((option) => option.current > 0)
    || options[0]
    || null;
  const canConfirm = !limited || Boolean(selected && selected.current > 0);
  const message = !limited
    ? "At will. No resource will be consumed."
    : !selected
      ? "No compatible resource is available."
      : selected.current > 0
        ? `${selected.label}: ${selected.current}/${selected.max} available.`
        : `${selected.label} has no uses remaining.`;
  return {
    item,
    name: text(item.name) || "Unnamed action",
    limited,
    options,
    selectedId: selected?.id || "",
    canConfirm,
    message,
  };
}

export function consumeV4ActionUse(character = {}, itemId, selectionId = "") {
  const plan = planV4ActionUse(character, itemId, selectionId);
  if (!plan.canConfirm) return { applied: false, consumed: null, plan };
  if (!plan.limited) return { applied: true, consumed: null, plan };
  const selected = plan.options.find((option) => option.id === plan.selectedId);
  if (!selected) return { applied: false, consumed: null, plan };
  const target = selected.kind === "slot"
    ? (character.spellcasting?.slots || []).find((slot) => slot.id === selected.targetId)
    : allItems(character).find((item) => item.id === selected.targetId);
  if (selected.kind === "slot") target.current = Math.max(0, Number(target.current) - 1);
  else target.uses.current = Math.max(0, Number(target.uses.current) - 1);
  return { applied: true, consumed: selected, plan: planV4ActionUse(character, itemId, selectionId) };
}
