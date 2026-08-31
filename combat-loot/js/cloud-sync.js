// Keeps Combat and Loot draft and preset records synchronized with D1.
import { readCloudJSON, writeCloudJSON } from "../../shared/js/cloud-store.js";

export function createCombatCloudSync({
  applyCloudWorkspace,
  confirmUpload = (message) => confirm(message),
  getLocalDraft,
  getLocalPartyLibrary = () => [],
  getLocalPresets,
  readCloud = readCloudJSON,
  showToast,
  writeCloud = writeCloudJSON,
}) {
  return async function restoreCloudWorkspace() {
    const cloud = await readCloud("api/combat-loot", { fallback: null });
    if (!cloud) return;
    const cloudPresets = Array.isArray(cloud.presets) ? cloud.presets : [];
    if (!cloudPresets.length && !cloud.draft && !cloud.partyLibrary) {
      const localPresets = getLocalPresets();
      const localDraft = getLocalDraft();
      const localPartyLibrary = getLocalPartyLibrary();
      if ((localPresets.length || localDraft || localPartyLibrary.length) && confirmUpload("Local Combat & Loot data was found. Upload it to the shared cloud database?")) {
        for (const preset of localPresets) {
          await writeCloud(`api/combat-loot/presets/${encodeURIComponent(preset.id)}`, preset);
        }
        if (localDraft) await writeCloud("api/combat-loot/draft", localDraft);
        if (localPartyLibrary.length) {
          await writeCloud("api/combat-loot/party-library", {
            version: 1,
            parties: localPartyLibrary,
          });
        }
        showToast("Local Combat & Loot data copied to D1.");
      }
      return;
    }

    applyCloudWorkspace({ ...cloud, presets: cloudPresets });
    showToast("Combat & Loot data restored from D1.");
  };
}
