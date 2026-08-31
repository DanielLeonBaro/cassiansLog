// Verifies runtime settings and fallbacks.
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const settingsURL = pathToFileURL(path.resolve("shared/js/settings.js")).href;

async function loadSettings(label, fetchImplementation) {
  global.fetch = fetchImplementation;
  return import(`${settingsURL}?test=${label}-${Date.now()}`);
}

(async () => {
  const originalLocation = global.location;
  const originalLocalStorage = global.localStorage;
  delete global.location;
  delete global.localStorage;

  let module = await loadSettings("v2", async (url) => {
    assert.equal(url, "api/settings");
    return {
      ok: true,
      json: async () => ({
        sections: { notes: true },
        characterSheetStyle: "v2",
        characterSheetStyleOverrides: { cassian: "v1", ally: "v2", invalid: "future" },
        writeProtectionEnabled: true,
      }),
    };
  });
  assert.equal(module.normalizeCharacterSheetStyle("v1"), "v1");
  assert.equal(module.normalizeCharacterSheetStyle("v2"), "v2");
  assert.equal(module.normalizeCharacterSheetStyle("unknown"), "v1");
  const remote = await module.runtimeSettingsReady;
  assert.equal(remote.characterSheetStyle, "v2");
  assert.deepEqual(remote.characterSheetStyleOverrides, { cassian: "v1", ally: "v2" });
  assert.equal(module.resolveCharacterSheetStyle(remote, "cassian"), "v1");
  assert.equal(module.resolveCharacterSheetStyle(remote, "ally"), "v2");
  assert.equal(module.resolveCharacterSheetStyle(remote, "karma"), "v2");

  module = await loadSettings("legacy", async (url) => {
    assert.equal(url, "api/settings");
    return { ok: true, json: async () => ({ sections: { notes: false } }) };
  });
  const legacy = await module.runtimeSettingsReady;
  assert.equal(legacy.characterSheetStyle, "v1");
  assert.deepEqual(legacy.characterSheetStyleOverrides, {});

  module = await loadSettings("fallback", async (url) => {
    if (url === "api/settings") throw new Error("offline");
    assert.match(String(url), /shared\/config\/sections\.json$/);
    return { ok: true, json: async () => ({ sections: { inventory: true } }) };
  });
  const fallback = await module.runtimeSettingsReady;
  assert.equal(fallback.characterSheetStyle, "v1");
  assert.equal(fallback.sections.inventory, true);

  const values = new Map([["cassianslog-runtime-settings", JSON.stringify({
    sections: { notes: false },
    characterSheetStyle: "v2",
    characterSheetStyleOverrides: { cassian: "v1" },
    openWrites: false,
  })]]);
  global.location = { hostname: "127.0.0.1" };
  global.localStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  module = await loadSettings("local", async (url) => {
    assert.match(String(url), /shared\/config\/sections\.json$/);
    return { ok: true, json: async () => ({ sections: { inventory: true, notes: true } }) };
  });
  const local = await module.runtimeSettingsReady;
  assert.equal(local.characterSheetStyle, "v2");
  assert.equal(local.openWrites, false);
  assert.equal(local.writeProtectionEnabled, true);
  assert.equal(local.sections.inventory, true);
  assert.equal(local.sections.notes, false);
  assert.equal(module.resolveCharacterSheetStyle(local, "cassian"), "v1");
  assert.equal(module.resolveCharacterSheetStyle(local, "ally"), "v2");
  assert.equal(module.isLocalRuntimeHost("localhost"), true);
  assert.equal(module.isLocalRuntimeHost("127.0.0.1"), true);
  assert.equal(module.isLocalRuntimeHost("::1"), true);
  assert.equal(module.isLocalRuntimeHost("cassianslog.urhyse.workers.dev"), false);

  const saved = module.persistLocalRuntimeSettings({
    sections: { notes: true },
    characterSheetStyle: "v1",
    characterSheetStyleOverrides: { cassian: "v2" },
    openWrites: true,
  });
  assert.equal(saved.characterSheetStyle, "v1");
  assert.equal(saved.writeProtectionEnabled, false);
  assert.deepEqual(JSON.parse(values.get(module.LOCAL_RUNTIME_SETTINGS_KEY)).sections, { notes: true });
  assert.deepEqual(
    JSON.parse(values.get(module.LOCAL_RUNTIME_SETTINGS_KEY)).characterSheetStyleOverrides,
    { cassian: "v2" },
  );
  const localStyleSave = await module.saveCharacterSheetStyleOverride("ally", "v1");
  assert.equal(localStyleSave.style, "v1");
  assert.deepEqual(
    JSON.parse(values.get(module.LOCAL_RUNTIME_SETTINGS_KEY)).characterSheetStyleOverrides,
    { cassian: "v2", ally: "v1" },
    "Local player changes should update the same override map used by local Admin.",
  );

  if (originalLocation === undefined) delete global.location;
  else global.location = originalLocation;
  if (originalLocalStorage === undefined) delete global.localStorage;
  else global.localStorage = originalLocalStorage;

  console.log("Runtime settings normalization, fallback, and localhost tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
