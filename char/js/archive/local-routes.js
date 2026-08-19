const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export async function enableLocalCharacterRoutes() {
  if (!("serviceWorker" in navigator) || !LOCAL_HOSTS.has(location.hostname)) return;

  try {
    await navigator.serviceWorker.register("character-route-worker.js", { scope: "/" });
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
    console.warn("Canonical localhost character routes are unavailable.", error);
  }
}
