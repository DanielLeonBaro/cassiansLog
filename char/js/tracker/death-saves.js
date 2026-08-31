// Normalizes and mutates death-save and stabilization state.
function clampCount(value) {
  return Math.max(0, Math.min(3, Math.trunc(Number(value) || 0)));
}

export function normalizeDeathSaves(value = {}) {
  return {
    failures: clampCount(value.failures),
    successes: clampCount(value.successes),
    stable: value.stable === true || Number(value.stable) === 1 ? 1 : 0,
  };
}

export function toggleDeathSave(deathSaves, kind, index) {
  if (!["failures", "successes"].includes(kind) || index < 0 || index > 2)
    return false;
  deathSaves[kind] = index < deathSaves[kind] ? index : index + 1;
  return true;
}

export function toggleStable(deathSaves) {
  deathSaves.stable = deathSaves.stable === 1 ? 0 : 1;
}

export function resetDeathSaves(deathSaves) {
  deathSaves.failures = 0;
  deathSaves.successes = 0;
  deathSaves.stable = 0;
}
