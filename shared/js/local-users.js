// Provides deterministic browser-only identities for localhost permission testing.
const LOCAL_USER_KEY = "cassianslog-local-user-v1";

export const LOCAL_ADMIN_USER = Object.freeze({
  id: "localhost-admin",
  email: "admin@localhost.test",
  label: "Local Admin",
  roles: ["characters", "player-screen", "dm-screen", "wiki", "compendium", "combat-loot", "public-initiative", "music", "admin"],
  providers: [],
  isPrimaryAdmin: true,
  localBypass: true,
});

export const LOCAL_TEST_USERS = Object.freeze(Array.from({ length: 20 }, (_, index) => {
  const number = String(index + 1).padStart(2, "0");
  return Object.freeze({
    id: `localhost-player-${number}`,
    email: `player${number}@localhost.test`,
    label: `Test Player ${number}`,
    roles: ["characters", "player-screen", "wiki", "compendium", "combat-loot", "public-initiative", "music"],
    providers: [],
    isPrimaryAdmin: false,
    localBypass: true,
  });
}));

export const LOCAL_USERS = Object.freeze([LOCAL_ADMIN_USER, ...LOCAL_TEST_USERS]);

export function currentLocalUser(storage = globalThis.localStorage) {
  let selectedId = "";
  try {
    selectedId = storage?.getItem(LOCAL_USER_KEY) || "";
  } catch {
    // Storage may be unavailable in privacy-restricted browser contexts.
  }
  return LOCAL_USERS.find((user) => user.id === selectedId) || LOCAL_ADMIN_USER;
}

export function selectLocalUser(userId, storage = globalThis.localStorage) {
  const user = LOCAL_USERS.find((candidate) => candidate.id === userId);
  if (!user) throw new Error("Choose a valid localhost test user.");
  storage?.setItem(LOCAL_USER_KEY, user.id);
  return user;
}
