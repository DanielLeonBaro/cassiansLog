// Resolves routed character data, injects the tracker shell, and starts editor and tracker code.
import { readJSON, removeStored, writeJSON } from "../../shared/js/storage.js";
import { readCloudJSON } from "../../shared/js/cloud-store.js";
import { runtimeSettingsReady } from "../../shared/js/settings.js";
import { cloneJSON } from "../../shared/js/text.js";
import { migrateLegacyPortrait } from "./archive/repository.js";
import { renderCharacterLoadError } from "./load-error.js";
import {
  CHARACTERS_STORAGE_KEY,
  PENDING_CHARACTER_STORAGE_KEY,
} from "./storage-keys.js";
import { applyCharacterSheetLayout } from "./tracker/layout.js";
import { currentCampaignSlug } from "../../shared/js/campaign-context.js";

export function initializeCharacterPage() {
  const loaderScript = document.querySelector("script[data-character]");
  const bundledCharacter = loaderScript?.dataset.character;
  const params = new URLSearchParams(window.location.search);
  const routeMatch = window.location.pathname.match(/(?:\/c\/[a-z]{2,48})?\/char\/([^/]+)\/?$/i);
  const routeCharacter = routeMatch ? decodeURIComponent(routeMatch[1]) : "";
  const requestedCharacter = params.get("character") || (
    bundledCharacter === "template" && routeCharacter !== "template"
      ? routeCharacter
      : bundledCharacter
  );
  const characterName = /^[a-z0-9-]+$/i.test(requestedCharacter || "")
    ? requestedCharacter
    : bundledCharacter;
  let characterShell = bundledCharacter;
  const trackerURL = new URL("../tracker.html", window.location.href);

  async function useCanonicalCharacterRoute() {
    if (bundledCharacter !== "template" || !params.has("character")) return;
    const canonical = new URL(`char/${encodeURIComponent(characterName)}/`, document.baseURI);
    params.delete("character");
    canonical.search = params.toString();
    window.history.replaceState(null, "", canonical);

    try {
      const response = await fetch(new URL("../catalog.json", import.meta.url));
      if (!response.ok) return;
      const catalog = await response.json();
      if (!catalog.characters?.includes(characterName)) return;
      characterShell = characterName;
    } catch (error) {
      console.warn("Could not resolve the character shell.", error);
    }
  }

  function applyBundledUpdates(savedCharacter, bundledData) {
    const update = bundledData?.bundledUpdate;
    const version = Number(update?.version) || 0;
    const appliedVersions = savedCharacter.bundledUpdateVersions || {};
    const appliedVersion = Number(appliedVersions[bundledData?.id]) || 0;

    if (!version || version <= appliedVersion) return false;

    Object.entries(update.additions || {}).forEach(([collection, ids]) => {
      if (!Array.isArray(savedCharacter[collection])) savedCharacter[collection] = [];
      const bundledEntries = Array.isArray(bundledData[collection])
        ? bundledData[collection]
        : [];

      ids.forEach((id) => {
        const alreadyPresent = savedCharacter[collection].some(
          (entry) => entry.id === id,
        );
        const bundledEntry = bundledEntries.find((entry) => entry.id === id);
        if (!alreadyPresent && bundledEntry) {
          savedCharacter[collection].push(
            cloneJSON(bundledEntry),
          );
        }
      });
    });

    savedCharacter.bundledUpdateVersions = {
      ...appliedVersions,
      [bundledData.id]: version,
    };
    return true;
  }

  async function loadCharacterPage() {
    if (!characterName || !/^[a-z0-9-]+$/i.test(characterName)) {
      renderCharacterLoadError("This character route is invalid.", { showBackLink: true });
      return;
    }

    try {
      await useCanonicalCharacterRoute();
      const [response, settings] = await Promise.all([
        fetch(trackerURL),
        runtimeSettingsReady,
      ]);
      if (!response.ok) throw new Error(`Could not load the tracker layout (${response.status}).`);

      const markup = await response.text();
      const trackerDocument = new DOMParser().parseFromString(markup, "text/html");
      trackerDocument.body.querySelectorAll("script").forEach((script) => script.remove());

      document.body.className = trackerDocument.body.className;
      document.body.id = trackerDocument.body.id;
      document.body.innerHTML = trackerDocument.body.innerHTML;
      document.body.dataset.characterShell = characterShell || "";
      applyCharacterSheetLayout(settings, characterName);
      const { initializeTrackerHeader } = await import("./tracker/header.js");
      initializeTrackerHeader();

      const savedCharacters = readJSON(CHARACTERS_STORAGE_KEY, {});
      const savedCharacter = savedCharacters[characterName];
      const cloudCharacter = await readCloudJSON(
        `api/characters/${encodeURIComponent(characterName)}`,
        { fallback: null },
      );
      if (currentCampaignSlug() && !cloudCharacter?.document) {
        throw new Error("This character is not active in this campaign.");
      }
      document.body.dataset.characterCanEdit = String(cloudCharacter?.canEdit !== false);
      document.body.dataset.characterCanManage = String(cloudCharacter?.canManage !== false);
      if (cloudCharacter?.canEdit === false) document.getElementById("notesSection")?.remove();
      const characterDataURL = characterShell === "template"
        ? new URL("../template/character.json", import.meta.url)
        : new URL(`../${encodeURIComponent(characterShell)}/character.json`, import.meta.url);
      const characterResponse = await fetch(characterDataURL);
      if (!characterResponse.ok) {
        throw new Error(`Could not load the character data (${characterResponse.status}).`);
      }
      const bundledData = await characterResponse.json();
      window.character = cloudCharacter?.document || bundledData;
      if (!cloudCharacter?.document && savedCharacter) {
        const migrated = migrateLegacyPortrait(savedCharacter);
        if (applyBundledUpdates(savedCharacter, bundledData) || migrated) {
          savedCharacters[characterName] = savedCharacter;
          writeJSON(CHARACTERS_STORAGE_KEY, savedCharacters);
        }
        window.character = savedCharacter;
      } else if (cloudCharacter?.document) {
        savedCharacters[characterName] = cloneJSON(cloudCharacter.document);
        writeJSON(CHARACTERS_STORAGE_KEY, savedCharacters);
      } else if (params.get("new") === "1") {
        const pending = readJSON(PENDING_CHARACTER_STORAGE_KEY, {});
        window.character = cloneJSON(window.character);
        window.character.id = characterName;
        window.character.name = pending.name || "New Character";
        window.character.portrait = "shared/assets/bat.ico";
        savedCharacters[characterName] = window.character;
        writeJSON(CHARACTERS_STORAGE_KEY, savedCharacters);
        removeStored(PENDING_CHARACTER_STORAGE_KEY);
      }
      await import("./entries/tracker.js");
    } catch (error) {
      console.error("Could not load character page:", error);
      renderCharacterLoadError(error.message, { showBackLink: true });
    }
  }

  loadCharacterPage();
}
