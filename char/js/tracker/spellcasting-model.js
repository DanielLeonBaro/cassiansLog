// Normalizes spellcasting profiles, preparation limits, and legacy spell data.
export function normalizeSpellcastingData(target) {
  if (!target.spellcasting) target.spellcasting = { enabled: false, profiles: [], slots: [] };
  const profiles = Array.isArray(target.spellcasting.profiles) ? target.spellcasting.profiles : [];
  if (!profiles.length && ((target.spellcasting.slots || []).length || (target.spells || []).length)) {
    profiles.push({
      id: "spellcasting",
      name: "Spellcasting",
      ability: target.spells?.[0]?.spellcasting || "",
      saveDC: null,
      attackBonus: null,
      preparedLimit: 0,
    });
  }
  const profileIds = new Set();
  const remappedIds = new Map();
  profiles.forEach((profile, index) => {
    const oldId = String(profile.id || "");
    const base = slugifyIdentifier(oldId || profile.name || `spellcasting-${index + 1}`) || `spellcasting-${index + 1}`;
    let id = base;
    let suffix = 2;
    while (profileIds.has(id)) id = `${base}-${suffix++}`;
    profileIds.add(id);
    if (oldId) remappedIds.set(oldId, id);
    profile.id = id;
    const migratedLimit = target.id === "karma" && /\bcleric\b/i.test(profile.name || "")
      ? 8
      : target.id === "ally" && /\bartificer\b/i.test(profile.name || "") ? 7 : 0;
    profile.preparedLimit = Math.max(0,
      Object.prototype.hasOwnProperty.call(profile, "preparedLimit")
        ? Number(profile.preparedLimit) || 0
        : migratedLimit,
    );
  });
  target.spellcasting.profiles = profiles;

  const fallbackProfile = profiles[0];
  const slots = Array.isArray(target.spellcasting.slots) ? target.spellcasting.slots : [];
  const slotIds = new Set();
  slots.forEach((slot, index) => {
    const base = slugifyIdentifier(slot.id || `slot-${index + 1}`) || `slot-${index + 1}`;
    let id = base;
    let suffix = 2;
    while (slotIds.has(id)) id = `${base}-${suffix++}`;
    slotIds.add(id);
    slot.id = id;
    slot.profileId = remappedIds.get(slot.profileId) ||
      (profileIds.has(slot.profileId) ? slot.profileId : fallbackProfile?.id || "");
  });
  target.spellcasting.slots = slots;

  (target.spells || []).forEach((spell) => {
    const matchingProfile = profiles.find((profile) =>
      String(profile.ability || "").toUpperCase() === String(spell.spellcasting || "").toUpperCase(),
    );
    spell.source = remappedIds.get(spell.source) ||
      (profileIds.has(spell.source) ? spell.source : matchingProfile?.id || fallbackProfile?.id || "");
    if (typeof spell.prepared !== "boolean") {
      spell.prepared = /\bprepared\b/i.test(spell.category || "") &&
        !/\bunprepared\b/i.test(spell.category || "");
    }
  });
}

export function slugifyIdentifier(value) {
  return String(value || "").trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
