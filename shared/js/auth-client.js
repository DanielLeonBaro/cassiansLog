// Wraps browser authentication requests, session lookup, and logout behavior.
import { isLocalRuntimeHost } from "./runtime-host.js";
import { currentLocalUser } from "./local-users.js";

let sessionPromise;

export function currentSession() {
  if (isLocalRuntimeHost()) return Promise.resolve({ user: currentLocalUser() });
  if (!sessionPromise) {
    sessionPromise = fetch("api/auth/session", { headers: { accept: "application/json" } })
      .then((response) => response.ok ? response.json() : { user: null })
      .catch(() => ({ user: null }));
  }
  return sessionPromise;
}

export async function logout() {
  if (isLocalRuntimeHost()) {
    location.replace("/login/");
    return;
  }
  await fetch("api/auth/logout", { method: "POST", headers: { accept: "application/json" } });
  location.replace("login/");
}
