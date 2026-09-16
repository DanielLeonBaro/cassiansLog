// Normalizes V4 inventory display, filters, totals, and legal container choices.
function text(value) {
  return String(value ?? "").trim();
}

export function createV4InventoryFilterState() {
  return { search: "", status: "", container: "" };
}

export function v4InventoryItemModel(item = {}, state = {}, inventory = []) {
  const runtimeManaged = Boolean(item.instanceId);
  const automatic = item.automatic === true;
  const quantity = runtimeManaged ? Number(state.quantity ?? item.quantity) : Number(item.quantity);
  const containerId = runtimeManaged ? text(state.containerId ?? item.containerId) : text(item.containerId);
  const equipped = runtimeManaged ? Boolean(state.equipped) : Boolean(state.wearing);
  const attuned = Boolean(state.attuned);
  const containers = inventory
    .filter((candidate) => candidate?.instanceId && candidate.instanceId !== item.instanceId && candidate.containerCapacity !== null && candidate.containerCapacity !== undefined)
    .map((candidate) => ({ id: candidate.instanceId, name: text(candidate.name) || candidate.instanceId }));
  const container = inventory.find((candidate) => candidate?.instanceId === containerId);
  return {
    ...item,
    automatic,
    runtimeManaged,
    definedQuantity: Math.max(0, Number(item.quantity) || 0),
    quantity: Math.max(0, Number.isFinite(quantity) ? quantity : 0),
    containerId,
    containerName: text(container?.name),
    equipped,
    attuned,
    charges: item.charges ? {
      current: Math.max(0, Number(state.charges?.current ?? item.charges.current) || 0),
      max: Math.max(0, Number(item.charges.max) || 0),
      reset: text(item.charges.reset),
    } : null,
    containers,
  };
}

export function v4InventoryItemMatches(item = {}, filters = createV4InventoryFilterState()) {
  const query = text(filters.search).toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = [item.name, item.definitionId, item.containerName, item.description]
    .map((value) => text(value).toLowerCase()).join(" ");
  if (!query.every((part) => haystack.includes(part))) return false;
  if (filters.container === "loose" && item.containerId) return false;
  if (filters.container === "contained" && !item.containerId) return false;
  if (filters.container && !["loose", "contained"].includes(filters.container) && item.containerId !== filters.container) return false;
  if (filters.status === "equipped" && !item.equipped) return false;
  if (filters.status === "attuned" && !item.attuned) return false;
  if (filters.status === "charges" && !item.charges) return false;
  if (filters.status === "containers" && (item.containerCapacity === null || item.containerCapacity === undefined)) return false;
  if (filters.status === "manual" && item.automatic) return false;
  return true;
}

export function v4InventorySummary(character = {}, models = []) {
  const burden = character.encumbrance && typeof character.encumbrance === "object" ? character.encumbrance : {};
  const baseWeight = Number.isFinite(Number(character.inventoryWeight)) ? Number(character.inventoryWeight) : null;
  const quantityAdjustment = models.reduce((sum, item) => Number.isFinite(Number(item.unitWeight))
    ? sum + (item.quantity - item.definedQuantity) * Number(item.unitWeight)
    : sum, 0);
  const weight = baseWeight === null ? null : Math.max(0, baseWeight + quantityAdjustment);
  const capacity = Number.isFinite(Number(burden.capacity)) ? Number(burden.capacity) : null;
  let encumbrance = text(burden.status) || "not calculated";
  if (weight !== null && capacity !== null && burden.mode !== "none") {
    encumbrance = weight > capacity ? "over-capacity"
      : burden.mode === "variant" && weight > capacity * 2 / 3 ? "heavily-encumbered"
        : burden.mode === "variant" && weight > capacity / 3 ? "encumbered" : "normal";
  }
  return {
    count: models.reduce((sum, item) => sum + item.quantity, 0),
    attuned: models.filter((item) => item.attuned).length,
    attunementLimit: 3,
    weight,
    capacity,
    encumbrance,
  };
}
