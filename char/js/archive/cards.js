export function createCharacterCard(character, { onRemove }) {
  const card = document.createElement("article");
  card.className = "group relative flex h-full flex-col overflow-hidden rounded-2xl border border-stone-300/80 bg-white/75 shadow-card backdrop-blur-sm transition hover:-translate-y-1 hover:border-blood-500/40 hover:shadow-xl dark:border-white/10 dark:bg-white/[.055]";
  const portrait = document.createElement("img");
  portrait.className = "aspect-[16/10] w-full object-cover";
  portrait.src = character.portrait || "shared/assets/bat.ico";
  portrait.alt = `${character.name} portrait`;
  portrait.addEventListener("error", () => { portrait.src = "shared/assets/bat.ico"; }, { once: true });

  const body = document.createElement("div");
  body.className = "flex grow flex-col justify-between p-5";
  const text = document.createElement("div");
  const name = document.createElement("h3");
  name.className = "font-display text-2xl font-bold";
  name.textContent = character.name;
  const description = document.createElement("p");
  description.className = "mt-2 leading-relaxed text-stone-500 dark:text-stone-400";
  description.textContent = character.description || "Open character tracker.";
  text.append(name, description);

  const route = `char/${encodeURIComponent(character.id)}/`;
  const actions = document.createElement("div");
  actions.className = "relative z-10 flex shrink-0 flex-wrap gap-2 pt-5";
  const open = document.createElement("a");
  open.className = "inline-flex grow items-center justify-center gap-2 rounded-xl border border-blood-500 bg-blood-500 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:border-blood-600 hover:bg-blood-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";
  open.href = route;
  open.innerHTML = 'Open tracker <i class="bi bi-arrow-right ml-1"></i>';
  const edit = document.createElement("a");
  edit.className = "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-sky-600 text-sky-600 transition hover:bg-sky-600 hover:text-white";
  edit.href = `${route}?edit=1`;
  edit.setAttribute("aria-label", `Edit ${character.name}`);
  edit.innerHTML = '<i class="bi bi-pencil-fill"></i>';
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-blood-500 text-blood-500 transition hover:bg-blood-500 hover:text-white";
  remove.setAttribute("aria-label", `Remove ${character.name}`);
  remove.innerHTML = '<i class="bi bi-trash-fill"></i>';
  remove.addEventListener("click", () => onRemove(character));
  actions.append(open, edit, remove);
  body.append(text, actions);
  card.append(portrait, body);
  return card;
}
