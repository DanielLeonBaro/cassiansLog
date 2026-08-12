import { applySectionVisibility } from "./sections.js";

const linkClass = "inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold shadow-sm transition";
const idleClass = "border-stone-400 bg-white/70 text-stone-700 hover:border-blood-500 hover:text-blood-500 dark:border-white/20 dark:bg-white/5 dark:text-stone-200";
const activeClass = "border-blood-500 bg-blood-500 text-white";

const pages = [
  { id: "characters", href: "char/", icon: "bi-people-fill", label: "Characters" },
  { id: "wiki", href: "wiki/", icon: "bi-book-half", label: "Wiki" },
  { id: "compendium", href: "compendium/", icon: "bi-journals", label: "Compendium" },
];

function pageLink(page, activePage) {
  const active = page.id === activePage;
  return `<a class="${linkClass} ${active ? activeClass : idleClass}" href="${page.href}" data-section-link="${page.id}"${active ? ' aria-current="page"' : ""}>
    <i class="bi ${page.icon}"></i><span class="hidden sm:inline">${page.label}</span>
  </a>`;
}

export function mountSiteHeader({ activePage, actions = "", tracker = false } = {}) {
  const mount = document.querySelector("[data-site-header]");
  if (!mount) return;
  const orderedPages = tracker
    ? [pages[0], pages[2], pages[1]]
    : [...pages].sort((left, right) => Number(left.id === activePage) - Number(right.id === activePage));
  const links = orderedPages
    .filter((page) => !(tracker && page.id === "characters"))
    .filter((page) => !(activePage === "characters" && page.id === "characters"))
    .map((page) => pageLink(page, activePage))
    .join("");
  const home = tracker
    ? pageLink(pages[0], activePage)
    : `<a class="flex h-10 items-center gap-2 font-display text-lg font-semibold hover:text-blood-500" href="char/"><i class="bi bi-journal-bookmark-fill text-blood-500"></i>Cassian's Log</a>`;
  mount.className = "sticky top-0 z-30 border-b border-stone-300/70 bg-parchment/90 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-ink/90";
  mount.setAttribute("aria-label", tracker ? "Character tools" : "Site navigation");
  const startActions = typeof actions === "string" ? actions : actions.start || "";
  const endActions = typeof actions === "string" ? "" : actions.end || "";
  mount.innerHTML = `<div class="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
    <div class="flex items-center gap-2">${home}${links}${startActions}</div>
    <div class="flex items-center gap-2">${endActions}<div id="page-header-actions"></div><button id="theme-toggle" type="button" class="${linkClass} ${idleClass}" aria-label="Switch theme"><i id="theme-icon" class="bi bi-sun-fill"></i></button></div>
  </div>`;
  applySectionVisibility(mount);
}
