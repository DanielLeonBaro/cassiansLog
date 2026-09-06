// Coordinates campaign discovery, password joining, and creation.
import { normalizeText, escapeAttribute, escapeHTML } from "../../shared/js/text.js";
import { mountSiteHeader } from "../../shared/js/site-header.js";
import { initializeTheme } from "../../shared/js/theme.js";

mountSiteHeader({ activePage: "campaigns" });
initializeTheme();

const root = document.getElementById("campaign-list");
const status = document.getElementById("campaign-status");
const createForm = document.getElementById("campaign-create");
const createBannerInput = document.getElementById("campaign-create-banner");
const createBannerPreview = document.getElementById("campaign-create-banner-preview");
let createBanner = "";

function setStatus(message, error = false) {
  status.textContent = message;
  status.className = `mb-5 min-h-6 text-sm ${error ? "text-danger-500" : "text-stone-500"}`;
}

async function requestJSON(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { accept: "application/json", ...(options.body ? { "content-type": "application/json" } : {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Campaign request failed (${response.status}).`);
  return body;
}

function card(campaign) {
  const slug = escapeAttribute(campaign.slug);
  const manage = campaign.joined && ["dm", "admin"].includes(campaign.role)
    ? `<a href="/c/${slug}/manage/" class="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-sky-600 text-sky-600 transition hover:bg-sky-600 hover:text-white" aria-label="Edit ${escapeAttribute(campaign.name)}"><i class="bi bi-pencil-fill"></i></a>`
    : "";
  const action = campaign.joined
    ? `<div class="flex items-center gap-2"><a href="/c/${slug}/char/" class="inline-flex rounded-xl bg-blood-500 px-4 py-2 text-sm font-bold text-white">Enter</a>${manage}</div><span class="text-xs font-bold uppercase text-stone-500">${escapeHTML(campaign.role)}</span>`
    : campaign.joinEnabled
      ? `<form data-join="${slug}" class="flex gap-2"><input name="password" type="password" required minlength="6" maxlength="128" autocomplete="current-password" aria-label="${escapeAttribute(campaign.name)} password" class="min-w-0 grow rounded-xl border border-stone-300 bg-white px-3 py-2 dark:border-white/15 dark:bg-white/5" placeholder="Campaign password"><button class="rounded-xl bg-blood-500 px-4 py-2 text-sm font-bold text-white">Join</button></form>`
      : '<p class="text-sm font-bold text-stone-500">Joining is not enabled yet.</p>';
  const banner = campaign.banner
    ? `<img src="${escapeAttribute(campaign.banner)}" alt="" class="h-44 w-full object-cover">`
    : '<div class="flex h-44 items-center justify-center bg-stone-200/80 dark:bg-white/5"><i class="bi bi-image text-5xl text-stone-400" aria-hidden="true"></i></div>';
  return `<article class="overflow-hidden rounded-2xl border border-stone-300 bg-white/70 shadow-card transition hover:-translate-y-1 hover:border-blood-500/40 hover:shadow-xl dark:border-white/10 dark:bg-white/[.05]">${banner}<div class="p-5"><p class="text-xs font-bold uppercase tracking-wider text-blood-500">/${slug}</p><h2 class="mt-2 font-display text-2xl font-bold">${escapeHTML(campaign.name)}</h2><p class="mt-2 min-h-12 text-sm leading-relaxed text-stone-500 dark:text-stone-400">${escapeHTML(campaign.description || "No campaign description yet.")}</p><div class="mt-5 flex items-center justify-between gap-3">${action}</div></div></article>`;
}

createBannerInput.addEventListener("change", () => {
  const file = createBannerInput.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/") || file.size > 500_000) {
    createBannerInput.value = "";
    createBanner = "";
    createBannerPreview.classList.add("hidden");
    setStatus("Choose a supported image smaller than 500 KB.", true);
    return;
  }
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    createBanner = String(reader.result || "");
    createBannerPreview.src = createBanner;
    createBannerPreview.classList.remove("hidden");
  });
  reader.readAsDataURL(file);
});

async function load() {
  try {
    const result = await requestJSON("/api/campaigns");
    root.innerHTML = result.campaigns.map(card).join("") || '<p class="text-stone-500">No campaigns exist yet.</p>';
    const requested = new URLSearchParams(location.search).get("join");
    if (requested) root.querySelector(`[data-join="${CSS.escape(normalizeText(requested).replace(/[^a-z]/g, ""))}"] input`)?.focus();
  } catch (error) {
    setStatus(error.message, true);
  }
}

root.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-join]");
  if (!form) return;
  event.preventDefault();
  const button = form.querySelector("button");
  button.disabled = true;
  try {
    await requestJSON(`/api/campaigns/${encodeURIComponent(form.dataset.join)}/join`, { method: "POST", body: JSON.stringify({ password: new FormData(form).get("password") }) });
    location.assign(`/c/${encodeURIComponent(form.dataset.join)}/char/`);
  } catch (error) {
    setStatus(error.message, true);
    button.disabled = false;
  }
});

createForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(createForm);
  const submit = createForm.querySelector("button");
  submit.disabled = true;
  try {
    const result = await requestJSON("/api/campaigns", { method: "POST", body: JSON.stringify({ name: data.get("name"), slug: data.get("slug") || undefined, description: data.get("description"), banner: createBanner, password: data.get("password") }) });
    location.assign(`/c/${encodeURIComponent(result.campaign.slug)}/char/`);
  } catch (error) {
    setStatus(error.message, true);
    submit.disabled = false;
  }
});

await load();
