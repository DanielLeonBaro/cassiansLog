export function totalHitPoints(character) {
  return Number(character.hp.current) + Number(character.hp.temp);
}

export function applyDamage(character, amount) {
  if (amount <= 0) return false;
  const absorbed = Math.min(character.hp.temp, amount);
  character.hp.temp -= absorbed;
  character.hp.current = Math.max(0, character.hp.current - (amount - absorbed));
  return true;
}

export function applyHealing(character, amount) {
  if (amount <= 0) return false;
  character.hp.current = Math.min(character.hp.max, character.hp.current + amount);
  return true;
}

export function applyTemporaryHitPoints(character, amount) {
  character.hp.temp = Math.max(0, amount);
}
