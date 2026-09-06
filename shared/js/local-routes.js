// Registers the localhost navigation fallback for clean Character and campaign URLs.
import { isLocalRuntimeHost } from "./runtime-host.js";

export async function enableLocalRoutes() {
  if (!("serviceWorker" in navigator) || !isLocalRuntimeHost(location.hostname)) return;
  try {
    await navigator.serviceWorker.register("/character-route-worker.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    if (navigator.serviceWorker.controller) return;
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 1500);
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
    });
  } catch (error) {
    console.warn("Canonical localhost routes are unavailable.", error);
  }
}
