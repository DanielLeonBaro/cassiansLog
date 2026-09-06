// Coordinates campaign details, membership, assignments, password, and settings management.
import { currentCampaign, currentCampaignSlug } from "../../shared/js/campaign-context.js";
import { escapeAttribute, escapeHTML } from "../../shared/js/text.js";
import { mountSiteHeader } from "../../shared/js/site-header.js";
import { initializeTheme } from "../../shared/js/theme.js";

mountSiteHeader({ activePage: "campaign-manage" });
initializeTheme();

const slug = currentCampaignSlug();
const api = `/api/campaigns/${encodeURIComponent(slug)}`;
const status = document.getElementById("manage-status");
let campaign;
let members = [];
let characters = [];
let settings;
let pendingBanner = null;

function setStatus(message, error = false) {
  status.textContent = message;
  status.className = `mt-2 min-h-6 text-sm ${error ? "text-danger-500" : "text-stone-500"}`;
}

async function requestJSON(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { accept: "application/json", ...(options.body ? { "content-type": "application/json" } : {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Campaign request failed (${response.status}).`);
  return body;
}

function renderMembers() {
  document.getElementById("campaign-members").innerHTML = members.map((member) => `<article data-member="${escapeAttribute(member.id)}" class="flex flex-wrap items-center gap-3 rounded-xl border border-stone-300 p-3 dark:border-white/10"><span class="min-w-48 grow"><strong class="block">${escapeHTML(member.email)}</strong><small class="text-stone-500">${escapeHTML(member.role)}</small></span><select data-role class="rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-white/15 dark:bg-stone-900"><option value="player"${member.role === "player" ? " selected" : ""}>Player</option><option value="dm"${member.role === "dm" ? " selected" : ""}>DM</option></select><button data-save-role class="rounded-lg border border-blood-500 px-3 py-2 text-sm font-bold text-blood-500">Save role</button><button data-remove-member class="rounded-lg border border-danger-500 px-3 py-2 text-sm font-bold text-danger-500">Remove</button></article>`).join("");
}

async function renderCharacters() {
  const root = document.getElementById("campaign-characters");
  const playerMembers = members.filter((member) => member.role === "player");
  const assignments = await Promise.all(characters.map((character) => requestJSON(`${api}/characters/${encodeURIComponent(character.id)}/assignments`)));
  root.innerHTML = characters.map((character, index) => `<fieldset data-character="${escapeAttribute(character.id)}" class="rounded-xl border border-stone-300 p-3 dark:border-white/10"><legend class="px-2 font-bold">${escapeHTML(character.document?.name || character.id)}</legend><div class="mt-2 flex flex-wrap gap-3">${playerMembers.map((member) => `<label class="inline-flex items-center gap-2"><input type="checkbox" value="${escapeAttribute(member.id)}"${assignments[index].editors.some((editor) => editor.id === member.id) ? " checked" : ""}> ${escapeHTML(member.email)}</label>`).join("") || '<span class="text-sm text-stone-500">No players to assign.</span>'}</div><button data-save-editors class="mt-3 rounded-lg border border-blood-500 px-3 py-2 text-sm font-bold text-blood-500" type="button">Save editors</button></fieldset>`).join("") || '<p class="text-sm text-stone-500">No campaign characters yet.</p>';
}

function renderSettings() {
  document.getElementById("campaign-sections").innerHTML = Object.entries(settings.sections).map(([id, visible]) => `<label class="flex items-center gap-2 rounded-lg border border-stone-300 px-3 py-2 dark:border-white/10"><input type="checkbox" data-section="${escapeAttribute(id)}"${visible ? " checked" : ""}> ${escapeHTML(id.replaceAll("-", " "))}</label>`).join("");
  document.querySelector(`[name="characterSheetStyle"][value="${settings.characterSheetStyle}"]`).checked = true;
  document.getElementById("campaign-character-styles").innerHTML = characters.map((character) => `<label class="flex items-center justify-between gap-3"><span class="truncate">${escapeHTML(character.document?.name || character.id)}</span><select data-style="${escapeAttribute(character.id)}" class="rounded-lg border border-stone-300 bg-white px-3 py-2 dark:border-white/15 dark:bg-stone-900"><option value="">Campaign default</option><option value="v1"${settings.characterSheetStyleOverrides[character.id] === "v1" ? " selected" : ""}>Style v1</option><option value="v2"${settings.characterSheetStyleOverrides[character.id] === "v2" ? " selected" : ""}>Style v2</option></select></label>`).join("");
}

async function load() {
  try {
    campaign = await currentCampaign();
    if (!campaign || !["dm", "admin"].includes(campaign.role)) throw new Error("Campaign DM access required.");
    const [memberResult, characterResult, settingsResult] = await Promise.all([
      requestJSON(`${api}/members`), requestJSON(`${api}/characters`), requestJSON(`${api}/settings`),
    ]);
    members = memberResult.members;
    characters = characterResult.characters;
    settings = settingsResult.settings;
    document.title = `Manage ${campaign.name} | Cassian's Log`;
    document.getElementById("manage-title").textContent = campaign.name;
    document.querySelector('#campaign-details [name="name"]').value = campaign.name;
    document.querySelector('#campaign-details [name="description"]').value = campaign.description || "";
    const bannerPreview = document.getElementById("campaign-banner-preview");
    bannerPreview.src = campaign.banner || "";
    bannerPreview.classList.toggle("hidden", !campaign.banner);
    renderMembers();
    await renderCharacters();
    renderSettings();
    if (campaign.role === "admin") {
      const form = document.getElementById("campaign-slug");
      form.classList.remove("hidden");
      form.elements.slug.value = campaign.slug;
      document.getElementById("leave-section").classList.add("hidden");
    }
  } catch (error) {
    setStatus(error.message, true);
  }
}

document.getElementById("campaign-details").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const data = new FormData(event.currentTarget);
    const banner = document.getElementById("campaign-banner-clear").checked ? "" : pendingBanner ?? campaign.banner ?? "";
    const result = await requestJSON(api, { method: "PATCH", body: JSON.stringify({ name: data.get("name"), description: data.get("description"), banner }) });
    campaign.name = result.name;
    campaign.description = result.description;
    campaign.banner = result.banner;
    pendingBanner = null;
    document.getElementById("campaign-banner-clear").checked = false;
    const preview = document.getElementById("campaign-banner-preview");
    preview.src = result.banner || "";
    preview.classList.toggle("hidden", !result.banner);
    document.getElementById("manage-title").textContent = result.name;
    setStatus("Campaign details saved.");
  } catch (error) { setStatus(error.message, true); }
});

document.getElementById("campaign-banner-input").addEventListener("change", (event) => {
  const file = event.currentTarget.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/") || file.size > 500_000) {
    event.currentTarget.value = "";
    setStatus("Choose a supported image smaller than 500 KB.", true);
    return;
  }
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    pendingBanner = String(reader.result || "");
    const preview = document.getElementById("campaign-banner-preview");
    preview.src = pendingBanner;
    preview.classList.remove("hidden");
    document.getElementById("campaign-banner-clear").checked = false;
  });
  reader.readAsDataURL(file);
});

document.getElementById("campaign-banner-clear").addEventListener("change", (event) => {
  document.getElementById("campaign-banner-preview").classList.toggle("hidden", event.currentTarget.checked);
});

document.getElementById("campaign-password").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await requestJSON(`${api}/password`, { method: "PUT", body: JSON.stringify({ password: new FormData(event.currentTarget).get("password") }) });
    event.currentTarget.reset();
    setStatus("Join password saved. Current members remain joined.");
  } catch (error) { setStatus(error.message, true); }
});

document.getElementById("campaign-slug").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const result = await requestJSON(`/api/admin/campaigns/${encodeURIComponent(campaign.id)}/slug`, { method: "PUT", body: JSON.stringify({ slug: new FormData(event.currentTarget).get("slug") }) });
    location.assign(`/c/${encodeURIComponent(result.slug)}/manage/`);
  } catch (error) { setStatus(error.message, true); }
});

document.getElementById("campaign-members").addEventListener("click", async (event) => {
  const card = event.target.closest("[data-member]");
  if (!card) return;
  try {
    if (event.target.closest("[data-save-role]")) await requestJSON(`${api}/members/${encodeURIComponent(card.dataset.member)}`, { method: "PATCH", body: JSON.stringify({ role: card.querySelector("[data-role]").value }) });
    else if (event.target.closest("[data-remove-member]")) {
      if (!confirm("Remove this member from the campaign?")) return;
      await requestJSON(`${api}/members/${encodeURIComponent(card.dataset.member)}`, { method: "DELETE" });
    } else return;
    await load();
    setStatus("Membership saved.");
  } catch (error) { setStatus(error.message, true); }
});

document.getElementById("campaign-characters").addEventListener("click", async (event) => {
  const fieldset = event.target.closest("[data-character]");
  if (!fieldset || !event.target.closest("[data-save-editors]")) return;
  try {
    const userIds = [...fieldset.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value);
    await requestJSON(`${api}/characters/${encodeURIComponent(fieldset.dataset.character)}/assignments`, { method: "PUT", body: JSON.stringify({ userIds }) });
    setStatus("Character editors saved.");
  } catch (error) { setStatus(error.message, true); }
});

document.getElementById("campaign-settings").addEventListener("submit", async (event) => {
  event.preventDefault();
  const sections = Object.fromEntries([...document.querySelectorAll("[data-section]")].map((input) => [input.dataset.section, input.checked]));
  const overrides = Object.fromEntries([...document.querySelectorAll("[data-style]")].filter((select) => select.value).map((select) => [select.dataset.style, select.value]));
  try {
    const result = await requestJSON(`${api}/settings`, { method: "PUT", body: JSON.stringify({ sections, characterSheetStyle: new FormData(event.currentTarget).get("characterSheetStyle"), characterSheetStyleOverrides: overrides }) });
    settings = result.settings;
    setStatus("Campaign settings saved.");
  } catch (error) { setStatus(error.message, true); }
});

document.getElementById("leave-campaign").addEventListener("click", async () => {
  if (!confirm("Leave this campaign?")) return;
  try {
    await requestJSON(`${api}/membership/me`, { method: "DELETE" });
    location.assign("/campaigns/");
  } catch (error) { setStatus(error.message, true); }
});

await load();
