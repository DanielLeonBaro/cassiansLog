import { DENSITY_PAGES } from "./catalog.js";
import { escapeHTML } from "../js/text.js";
import { currentUiState, updateUiPreferences, retryUiPreferences, uiPreferencesReady } from "./runtime.js";

export function mountAppearanceControls(root) {
  if (!root || root.querySelector("[data-gc-appearance]")) return;
  const section = document.createElement("section");
  section.dataset.gcAppearance = "";
  section.className = "gc-panel gc-appearance";
  section.innerHTML = `<h3>Workspace</h3><p class="gc-muted">Choose reading density and tracker layout. Page overrides apply across campaigns.</p>
    <div class="gc-form-grid"><label>Default density<select class="gc-field" data-gc-global-density><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label>
    ${["character", "npc"].map((kind) => `<label>${kind === "npc" ? "NPC" : "Character"} tracker<select class="gc-field" data-gc-tracker-style="${kind}"><option value="v2.1">2.1 · Base</option><option value="v2.2">2.2 · Character Sheet</option><option value="v6">V6 · Combat Desk</option><option value="v5">V5 · Workspace</option><option value="v1">V1 · Classic</option><option value="v2">V2 · Tabs</option><option value="v3">V3 · Personal layout</option><option value="v4">V4 · Detailed</option><option value="campaign">Follow campaign setting</option></select></label>`).join("")}</div>
    <p class="gc-muted">Layout choices apply automatically. Switching to or from an older layout reloads this tracker; save any drafts before changing it.</p>
    <details><summary>Density per page</summary><div class="gc-form-grid">${DENSITY_PAGES.map(({ id, label }) => `<label>${escapeHTML(label)}<select class="gc-field" data-gc-page-density="${id}"><option value="inherit">Use default</option><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label>`).join("")}</div></details>
    <div class="gc-toolbar"><p data-gc-sync-status role="status" aria-live="polite"></p><button type="button" class="gc-button" data-gc-retry hidden>Retry sync</button></div>`;
  root.prepend(section);
  function refresh() {
    const { preferences, status, message } = currentUiState();
    section.querySelector("[data-gc-global-density]").value = preferences.density;
    section.querySelectorAll("[data-gc-page-density]").forEach((select) => { select.value = preferences.pageDensity[select.dataset.gcPageDensity] || "inherit"; });
    section.querySelectorAll("[data-gc-tracker-style]").forEach((select) => { select.value = preferences.trackerStyles[select.dataset.gcTrackerStyle]; });
    section.querySelector("[data-gc-sync-status]").textContent = message;
    section.querySelector("[data-gc-retry]").hidden = status !== "error";
  }
  section.addEventListener("change", (event) => {
    const select = event.target;
    if (select.matches("[data-gc-global-density]")) void updateUiPreferences({ density: select.value });
    else if (select.dataset.gcPageDensity) void updateUiPreferences({ pageDensity: { [select.dataset.gcPageDensity]: select.value } });
    else if (select.dataset.gcTrackerStyle) {
      const kind = select.dataset.gcTrackerStyle;
      const style = select.value === "campaign" ? document.documentElement.dataset.campaignSheetStyle : select.value;
      document.dispatchEvent(new CustomEvent("tracker:layout-change", { detail: { kind, style } }));
      void updateUiPreferences({ trackerStyles: { [kind]: select.value } }).then(() => {
        const activeStyle = document.documentElement.dataset.characterSheetStyle;
        if (!activeStyle || kind !== (document.body.dataset.trackerKind || "character")) return;
        // Read the latest choice so an earlier sync cannot apply an obsolete selection.
        const preferred = currentUiState().preferences.trackerStyles[kind];
        const selected = preferred === "campaign" ? document.documentElement.dataset.campaignSheetStyle : preferred;
        if (selected !== activeStyle) window.location.reload();
      });
    }
  });
  section.querySelector("[data-gc-retry]").addEventListener("click", () => { void retryUiPreferences(); });
  document.addEventListener("cassianslog:ui-preferences", refresh);
  void uiPreferencesReady.then(refresh);
  refresh();
}
