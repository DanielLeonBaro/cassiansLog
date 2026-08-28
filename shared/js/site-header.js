import { applySectionVisibility, sectionConfigReady } from "./sections.js";
import { currentSession, logout } from "./auth-client.js";
import { mountAccountMenu } from "./account-menu.js";

const linkClass = "inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold shadow-sm transition";
const idleClass = "border-stone-400 bg-white/70 text-stone-700 hover:border-blood-500 hover:text-blood-500 dark:border-white/20 dark:bg-white/5 dark:text-stone-200";
const activeClass = "border-blood-500 bg-blood-500 text-white";
const menuItemClass = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-blood-500 transition hover:bg-blood-500/10";

const pages = [
  { id: "characters", href: "char/", icon: "bi-people-fill", label: "Characters" },
  { id: "player-screen", href: "player-screen/", icon: "bi-grid-fill", label: "Player Screen" },
  { id: "dm-screen", href: "dm-screen/", icon: "bi-shield-shaded", label: "DM Screen" },
  { id: "wiki", href: "wiki/", icon: "bi-book-half", label: "Wiki" },
  { id: "compendium", href: "compendium/", icon: "bi-journals", label: "Compendium" },
  { id: "combat-loot", href: "combat-loot/", icon: "bi-shield-shaded", label: "Combat & Loot" },
  { id: "public-initiative", href: "public-initiative/", icon: "bi-list-ol", label: "Public Initiative" },
  { id: "music", href: "music/", icon: "bi-music-note-beamed", label: "Music" },
  { id: "admin", href: "admin/", icon: "bi-shield-lock-fill", label: "Admin" },
];

const trackerPageOrder = ["characters", "player-screen", "dm-screen", "compendium", "wiki", "combat-loot", "public-initiative", "music", "admin"];

function pageMenuLink(page) {
  return `<a class="${menuItemClass}" href="${page.href}" data-section-link="${page.id}" data-role-link="${page.id}">
    <i class="bi ${page.icon}"></i>${page.label}
  </a>`;
}

function initializePageMenu(mount) {
  const group = mount.querySelector("[data-site-pages]");
  const button = mount.querySelector("#site-pages-menu-button");
  const menu = mount.querySelector("#site-pages-menu");
  if (!group || !button || !menu) return;

  const close = ({ focus = false } = {}) => {
    button.setAttribute("aria-expanded", "false");
    menu.classList.add("hidden");
    if (focus) button.focus();
  };
  button.addEventListener("click", () => {
    const expanded = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(!expanded));
    menu.classList.toggle("hidden", expanded);
  });
  menu.addEventListener("click", (event) => {
    if (event.target.closest("a")) close();
  });
  document.addEventListener("click", (event) => {
    if (!group.contains(event.target)) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && button.getAttribute("aria-expanded") === "true") {
      close({ focus: true });
    }
  });

  const syncAvailability = () => {
    group.hidden = ![...menu.querySelectorAll("[data-section-link]")]
      .some((link) => !link.hidden);
  };
  syncAvailability();
  sectionConfigReady.then(syncAvailability);
}

export function mountSiteHeader({ activePage, actions = "", tracker = false } = {}) {
  const mount = document.querySelector("[data-site-header]");
  if (!mount) return;
  const orderedPages = tracker
    ? trackerPageOrder.map((id) => pages.find((page) => page.id === id))
    : [...pages].sort((left, right) => Number(left.id === activePage) - Number(right.id === activePage));
  const menuItems = orderedPages
    .filter((page) => page.id !== activePage)
    .map(pageMenuLink)
    .join("");
  const pagesMenu = `<div class="relative" data-site-pages role="group">
    <button id="site-pages-menu-button" type="button" class="${linkClass} ${activeClass}" aria-expanded="false" aria-controls="site-pages-menu"><i class="bi bi-grid-fill"></i><span class="hidden sm:inline">Pages</span></button>
    <div id="site-pages-menu" class="absolute left-0 z-50 mt-2 hidden min-w-56 rounded-2xl border border-stone-200 bg-white p-2 shadow-2xl dark:border-white/10 dark:bg-stone-900" aria-labelledby="site-pages-menu-button">${menuItems}</div>
  </div>`;
  const home = `<a class="flex h-10 shrink-0 items-center gap-2 font-display text-lg font-semibold hover:text-blood-500" href="char/" aria-label="Cassian's Log home"><i class="bi bi-journal-bookmark-fill text-blood-500"></i><span class="hidden sm:inline">Cassian's Log</span></a>`;
  mount.className = "sticky top-0 z-30 border-b border-stone-300/70 bg-parchment/90 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-ink/90";
  mount.setAttribute("aria-label", tracker ? "Character tools" : "Site navigation");
  const startActions = typeof actions === "string" ? actions : actions.start || "";
  const endActions = typeof actions === "string" ? "" : actions.end || "";
  mount.innerHTML = `<div class="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:flex-nowrap sm:gap-3 sm:px-6 lg:px-8">
    <div class="flex min-w-0 flex-wrap items-center gap-2">${home}${pagesMenu}${startActions}</div>
    <div class="flex shrink-0 items-center gap-2">${endActions}<div id="page-header-actions"></div><button id="site-account" type="button" class="${linkClass} ${idleClass}" aria-label="Open my account settings"><i class="bi bi-person-circle"></i><span>Me</span></button><button id="site-logout" type="button" class="${linkClass} ${idleClass}" aria-label="Sign out"><i class="bi bi-box-arrow-right"></i><span class="hidden md:inline">Sign out</span></button><button id="theme-toggle" type="button" class="${linkClass} ${idleClass}" aria-label="Switch theme"><i id="theme-icon" class="bi bi-sun-fill"></i></button></div>
  </div>`;
  applySectionVisibility(mount);
  initializePageMenu(mount);
  mount.querySelector("#site-logout")?.addEventListener("click", logout);
  currentSession().then(({ user }) => {
    if (!user) return;
    const account = mount.querySelector("#site-account");
    mountAccountMenu(account, user);
    document.addEventListener("cassianslog:account-updated", (event) => {
      account.title = event.detail.email;
    });
    account.title = user.email;
    mount.querySelectorAll("[data-role-link]").forEach((link) => {
      const allowed = user.roles.includes(link.dataset.roleLink);
      link.hidden = !allowed;
      if (!allowed) link.style.setProperty("display", "none", "important");
    });
  });
}
