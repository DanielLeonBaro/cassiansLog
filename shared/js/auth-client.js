// Wraps browser authentication requests, session lookup, and logout behavior.
import { isLocalRuntimeHost } from "./runtime-host.js";

let sessionPromise;

const localhostUser = {
  id: "localhost",
  email: "localhost@cassianslog.local",
  roles: ["characters", "player-screen", "dm-screen", "wiki", "compendium", "combat-loot", "public-initiative", "music", "admin"],
  providers: [],
  isPrimaryAdmin: true,
  localBypass: true,
};

export function currentSession() {
  if (isLocalRuntimeHost()) return Promise.resolve({ user: localhostUser });
  if (!sessionPromise) {
    sessionPromise = fetch("api/auth/session", { headers: { accept: "application/json" } })
      .then((response) => response.ok ? response.json() : { user: null })
      .catch(() => ({ user: null }));
  }
  return sessionPromise;
}

export async function logout() {
  if (isLocalRuntimeHost()) {
    location.replace("/campaigns/");
    return;
  }
  await fetch("api/auth/logout", { method: "POST", headers: { accept: "application/json" } });
  location.replace("login/");
}
