// Builds shared page navigation, account actions, and role-aware link visibility.
import { applySectionVisibility, sectionConfigReady } from "../js/sections.js";
import { currentSession, logout } from "../js/auth-client.js";
import { mountAccountMenu } from "../js/account-menu.js";
import {
  availableCampaigns,
  campaignPagePath,
  campaignPath,
  campaignRouteForUnscopedPath,
  currentCampaign,
  currentCampaignSlug,
  rememberCampaignSlug,
  selectRememberedCampaign,
} from "../js/campaign-context.js";
import { enableLocalRoutes } from "../js/local-routes.js";
import { escapeHTML } from "../js/text.js";

import { PAGE_CATALOG as pages, NAVIGATION_GROUPS, uiPageId } from "./catalog.js";
import { applyUiPage, currentUiPreferences, uiPreferencesReady, updateUiPreferences, currentUiState, retryUiPreferences } from "./runtime.js";
import { createMenuController, enhanceComponents } from "./components.js";

const menuItemClass = "gc-nav-link";

function pageMenuLink(page, activePage) {
  const href = page.global ? `/${page.href}` : campaignPagePath(page.href);
  return `<a class="gc-nav-link" href="${href}" title="${page.label}" data-section-link="${page.id}" data-role-link="${page.id}"${page.id === activePage ? ' aria-current="page"' : ""}><i class="bi ${page.icon}" aria-hidden="true"></i><span class="gc-nav-label">${page.label}</span></a>`;
}

function initializeSidebar(mount) {
  const button = mount.querySelector("#site-pages-menu-button");
  const sidebar = mount.querySelector("#site-pages-menu");
  const backdrop = mount.querySelector("[data-gc-nav-backdrop]");
  const closeButton = mount.querySelector("[data-gc-nav-close]");
  const desktop = window.matchMedia("(min-width: 1024px)");
  let inertElements = [];
  const close = ({ focus = true } = {}) => {
    document.documentElement.dataset.navOpen = "false";
    sidebar.classList.add("hidden");
    sidebar.removeAttribute("role");
    sidebar.removeAttribute("aria-modal");
    button.setAttribute("aria-expanded", "false");
    document.body.classList.remove("overflow-hidden");
    inertElements.forEach(([element, wasInert]) => { element.inert = wasInert; });
    inertElements = [];
    if (focus && !desktop.matches) button.focus();
  };
  const open = () => {
    document.documentElement.dataset.navOpen = "true";
    sidebar.classList.remove("hidden");
    button.setAttribute("aria-expanded", "true");
    if (!desktop.matches) {
      sidebar.setAttribute("role", "dialog");
      sidebar.setAttribute("aria-modal", "true");
      document.body.classList.add("overflow-hidden");
      const content = [...document.body.children].filter((element) => element !== mount && !element.matches("script"));
      const header = mount.querySelector(".gc-header-inner");
      [...content, header].filter(Boolean).forEach((element) => { inertElements.push([element, element.inert]); element.inert = true; });
      closeButton.focus();
    }
  };
  button.addEventListener("click", () => document.documentElement.dataset.navOpen === "true" ? close() : open());
  backdrop.addEventListener("click", () => close());
  closeButton.addEventListener("click", () => close());
  sidebar.addEventListener("click", (event) => { if (event.target.closest("a")) close({ focus: false }); });
  sidebar.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { event.preventDefault(); close(); }
    if (event.key !== "Tab" || desktop.matches) return;
    const controls = [...sidebar.querySelectorAll("a[href],button")].filter((element) => !element.hidden && element.getClientRects().length);
    const first = controls[0], last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  desktop.addEventListener("change", () => close({ focus: false }));
  mount.querySelector("[data-gc-nav-collapse]").addEventListener("click", () => {
    void updateUiPreferences({ sidebarCollapsed: !currentUiPreferences().sidebarCollapsed });
  });
  const syncGroups = () => sidebar.querySelectorAll(".gc-nav-group").forEach((group) => {
    group.hidden = ![...group.querySelectorAll("[data-role-link]")].some((link) => !link.hidden);
  });
  sectionConfigReady.then(syncGroups);
  return syncGroups;
}

function scopeCampaignPageLinks(slug, root = document) {
  if (!slug) return;
  root.querySelectorAll("a[data-section-link]").forEach((link) => {
    const page = pages.find((candidate) => candidate.id === link.dataset.sectionLink);
    if (page && !["campaigns", "admin"].includes(page.id)) {
      link.href = campaignPath(slug, page.href);
    }
  });
}

function initializeCampaignMenu(mount, { activePage, tracker, current, campaigns, userId }) {
  const group = mount.querySelector("[data-site-campaigns]");
  const button = mount.querySelector("#site-campaign");
  const menu = mount.querySelector("#site-campaign-menu");
  if (!group || !button || !menu || !current) return;
  const { close } = createMenuController(button, menu);
  menu.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link) return;
    if (link.dataset.campaignSlug) rememberCampaignSlug(link.dataset.campaignSlug, { userId });
    close();
  });

  const currentPage = !tracker && pages.find((page) => page.id === activePage && !["campaigns", "admin", "campaign-manage"].includes(page.id));
  const choices = campaigns.filter((campaign) => campaign.joined);
  menu.innerHTML = `${choices.map((campaign) => {
      const destination = campaignPath(campaign.slug, currentPage?.href || "char");
      const selected = campaign.slug === current.slug;
      return `<a href="${destination}" data-campaign-slug="${campaign.slug}" class="${menuItemClass}"${selected ? ' aria-current="page"' : ""}><i class="bi ${selected ? "bi-check-circle-fill" : "bi-circle"}"></i><span class="truncate">${escapeHTML(campaign.name)}</span></a>`;
    }).join("")}<a href="/campaigns/" class="${menuItemClass} border-t border-stone-200 dark:border-white/10"><i class="bi bi-collection-fill"></i>All campaigns</a>`;
  button.textContent = current.name;
  button.title = `Switch from ${current.name}`;
  group.classList.remove("hidden");
}

export function mountSiteHeader({ activePage, actions = "", tracker = false } = {}) {
  enableLocalRoutes();
  const mount = document.querySelector("[data-site-header]");
  if (!mount) return;
  const minimal = activePage === "public-initiative";
  const id = uiPageId(activePage, { tracker, npc: activePage === "npcs", builder: document.body.dataset.gcPage?.endsWith("-builder") });
  applyUiPage(id);
  document.body.dataset.gcShell = minimal ? "minimal" : "workspace";
  const slug = currentCampaignSlug();
  const homeHref = slug ? campaignPagePath("char") : "/campaigns/";
  const home = `<a data-site-home class="gc-brand" href="${homeHref}" aria-label="Cassian's Log home"><i class="bi bi-journal-bookmark-fill" aria-hidden="true"></i><span>Cassian's Log</span></a>`;
  mount.className = "gc-header";
  mount.setAttribute("aria-label", tracker ? "Character tools" : "Site navigation");
  const startActions = typeof actions === "string" ? actions : actions.start || "";
  const endActions = typeof actions === "string" ? "" : actions.end || "";
  const sidebar = `<aside id="site-pages-menu" class="gc-sidebar hidden" aria-label="Pages"><div class="gc-sidebar-head">${home}<button type="button" class="gc-button gc-sidebar-collapse" data-gc-nav-collapse aria-label="Collapse sidebar"><i class="bi bi-layout-sidebar-inset" aria-hidden="true"></i></button><button type="button" class="gc-button gc-sidebar-close" data-gc-nav-close aria-label="Close navigation"><i class="bi bi-x-lg" aria-hidden="true"></i></button></div><nav class="gc-sidebar-links" aria-label="Project pages">${NAVIGATION_GROUPS.map((group) => `<section class="gc-nav-group"><h2>${group}</h2>${pages.filter((page) => page.group === group).map((page) => pageMenuLink(page, activePage)).join("")}</section>`).join("")}</nav><div class="gc-sidebar-footer">Your campaign workspace</div></aside><div class="gc-sidebar-backdrop" data-gc-nav-backdrop></div>`;
  mount.innerHTML = `<a class="gc-skip-link" href="#gc-main">Skip to content</a>${minimal ? "" : sidebar}<div class="gc-header-inner mx-auto w-full lg:max-w-[110rem]">
    <div class="gc-header-start">${minimal ? home : '<button id="site-pages-menu-button" type="button" class="gc-button gc-menu-mobile" aria-expanded="false" aria-controls="site-pages-menu" aria-label="Open page navigation"><i class="bi bi-list" aria-hidden="true"></i><span>Pages</span></button>'}<span class="gc-location">${pages.find((page) => page.id === activePage)?.label || ""}${tracker ? " / Tracker" : ""}</span><div data-site-campaigns class="relative hidden"><button id="site-campaign" type="button" class="gc-button rounded-full bg-blood-500 text-on-accent truncate" aria-expanded="false" aria-controls="site-campaign-menu"></button><div id="site-campaign-menu" class="absolute left-0 z-50 mt-2 hidden min-w-56 rounded-xl border p-2 shadow-xl"></div></div>${startActions}</div>
    <div class="gc-header-end">${endActions}<div id="page-header-actions"></div>${minimal ? "" : `<label class="gc-density-label" for="gc-page-density">Density</label><select id="gc-page-density" class="gc-field gc-density-select" aria-label="Density for this page"><option value="inherit">Use default</option><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select><button type="button" class="gc-button" data-gc-header-retry hidden title="Retry appearance sync" aria-label="Retry appearance sync"><i class="bi bi-cloud-slash" aria-hidden="true"></i></button><button id="site-account" type="button" class="gc-button" aria-label="Open my account settings"><i class="bi bi-person-circle" aria-hidden="true"></i><span>Me</span></button><button id="site-logout" type="button" class="gc-button" aria-label="Sign out"><i class="bi bi-box-arrow-right" aria-hidden="true"></i><span class="hidden md:inline">Sign out</span></button>`}<button id="theme-toggle" type="button" class="gc-button" aria-label="Appearance settings"><i id="theme-icon" class="bi bi-sliders" aria-hidden="true"></i></button></div>
  </div>`;
  const main = document.querySelector("main");
  new ResizeObserver(() => {
    document.documentElement.style.setProperty("--gc-header-height", `${mount.getBoundingClientRect().height}px`);
  }).observe(mount);
  if (main && !main.id) main.id = "gc-main";
  else if (main) mount.querySelector(".gc-skip-link").href = `#${main.id}`;
  const densityControl = mount.querySelector("#gc-page-density");
  densityControl?.addEventListener("change", () => { void updateUiPreferences({ pageDensity: { [document.body.dataset.gcPage || id]: densityControl.value } }); });
  const syncControls = () => {
    const { preferences, status, message } = currentUiState();
    if (densityControl) {
      densityControl.value = preferences.pageDensity[document.body.dataset.gcPage || id] || "inherit";
      densityControl.title = `Global default: ${preferences.density}`;
    }
    const retry = mount.querySelector("[data-gc-header-retry]");
    if (retry) {
      retry.hidden = status !== "error";
      retry.title = message || "Retry appearance sync";
    }
    const collapse = mount.querySelector("[data-gc-nav-collapse]");
    collapse?.setAttribute("aria-label", preferences.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar");
    collapse?.setAttribute("aria-expanded", String(!preferences.sidebarCollapsed));
  };
  mount.querySelector("[data-gc-header-retry]")?.addEventListener("click", () => { void retryUiPreferences(); });
  document.addEventListener("cassianslog:ui-preferences", syncControls);
  void uiPreferencesReady.then(syncControls);
  const syncGroups = minimal ? () => {} : initializeSidebar(mount);
  enhanceComponents(mount);
  applySectionVisibility(mount);
  scopeCampaignPageLinks(slug);

  mount.querySelector("#site-logout")?.addEventListener("click", logout);
  Promise.all([
    currentSession(),
    currentCampaign().catch(() => null),
    availableCampaigns().catch(() => []),
  ]).then(([{ user }, campaign, campaigns]) => {
    if (!user) return;
    const candidates = campaign && !campaigns.some((candidate) => candidate.slug === campaign.slug)
      ? [campaign, ...campaigns]
      : campaigns;
    const selectedCampaign = selectRememberedCampaign(candidates, {
      preferredSlug: campaign?.slug || slug,
      userId: user.id,
    });
    if (!slug && selectedCampaign) {
      const destination = campaignRouteForUnscopedPath(selectedCampaign.slug);
      if (destination) {
        location.replace(`${destination}${location.search}${location.hash}`);
        return;
      }
    }
    if (selectedCampaign) {
      scopeCampaignPageLinks(selectedCampaign.slug);
      mount.querySelector("[data-site-home]").href = campaignPath(selectedCampaign.slug, "char");
    }
    const account = mount.querySelector("#site-account");
    if (account) {
      mountAccountMenu(account, user);
      document.addEventListener("cassianslog:account-updated", (event) => {
        account.title = event.detail.email;
      });
      account.title = user.email;
    }
    // Page-level shortcuts use the same role contract as links inside the header.
    const campaignRole = selectedCampaign?.role;
    initializeCampaignMenu(mount, {
      activePage,
      tracker,
      current: selectedCampaign,
      campaigns: candidates,
      userId: user.id,
    });
    document.querySelectorAll("[data-role-link]").forEach((link) => {
      const id = link.dataset.roleLink;
      const allowed = selectedCampaign
        ? id === "admin" ? user.isPrimaryAdmin
          : id === "campaign-manage" ? ["dm", "admin"].includes(campaignRole)
          : id === "npcs" ? true
            : id !== "dm-screen" || ["dm", "admin"].includes(campaignRole)
        : id === "campaign-manage" ? false
          : id === "npcs" ? false
          : id === "admin" ? user.isPrimaryAdmin
            : id === "campaigns" || user.roles.includes(id);
      link.dataset.roleAllowed = String(allowed);
      link.hidden = !allowed;
      if (!allowed) link.style.setProperty("display", "none", "important");
    });
    applySectionVisibility();
    syncGroups();
  });
}
