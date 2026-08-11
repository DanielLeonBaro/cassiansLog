import { initializeTrackerHeader } from "../features/tracker/header.js";

function loadScript(source) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = source;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Could not load ${source}`));
    document.body.appendChild(script);
  });
}

function showError(message) {
  document.body.innerHTML = `<main class="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8"><div class="rounded-2xl border border-blood-500/30 bg-blood-500/10 p-4 text-blood-600 dark:text-red-300">${message}</div></main>`;
}

const requested = new URLSearchParams(location.search).get("character") || "cassian";
const characterName = /^[a-z0-9-]+$/i.test(requested) ? requested : "cassian";
try {
  await loadScript(`data/characters/${characterName}.js`);
  if (!window.character) throw new Error("The character file loaded, but window.character was not found.");
  initializeTrackerHeader();
  await import("./tracker.js");
} catch (error) {
  console.error("Could not load standalone tracker:", error);
  showError(error.message);
}
