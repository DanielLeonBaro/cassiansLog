// Stores campaign NPCs locally first and syncs manager changes to D1.
import { readJSON, writeJSON } from "../../shared/js/storage.js";
import { readCloudJSON, writeCloudJSON } from "../../shared/js/cloud-store.js";
import { cloneJSON } from "../../shared/js/text.js";
import { campaignCanManage, currentCampaign, currentCampaignSlug } from "../../shared/js/campaign-context.js";
import { isLocalRuntimeHost } from "../../shared/js/runtime-host.js";
import { defaultNpcVisibility, projectNpcForPlayer } from "../../shared/js/npc-visibility.js";
import { applyImportedCharacterSetup, applyNewCharacterSetup } from "../../char/js/archive/repository.js";
import { normalizeCharacterDocument } from "../../char/js/model.js";
import { NPCS_STORAGE_KEY } from "../../char/js/storage-keys.js";

export function storedNpcRecords() {
  const value = readJSON(NPCS_STORAGE_KEY, {});
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function npcId(name, records = storedNpcRecords()) {
  const base = String(name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "npc";
  let id = base;
  let suffix = 2;
  while (records[id]) id = `${base}-${suffix++}`;
  return id;
}

export async function listNpcs() {
  const campaign = await currentCampaign();
  const canManage = ["dm", "admin"].includes(campaign?.role);
  if (!currentCampaignSlug() || !campaign?.joined) return { npcs: [], canManage: false };
  if (!isLocalRuntimeHost()) {
    const cloud = await readCloudJSON("api/npcs", { fallback: null });
    if (cloud?.authoritative) {
      const npcs = [...(cloud.npcs || [])];
      if (cloud.canManage === true) {
        const cloudIds = new Set(npcs.map((record) => record.id));
        Object.values(storedNpcRecords()).forEach((record) => {
          if (!record?.document?.id || cloudIds.has(record.document.id)) return;
          const playerProjection = projectNpcForPlayer(record.document, record.visibility);
          npcs.push({
            id: record.document.id,
            document: cloneJSON(record.document),
            visibility: record.visibility || {},
            visibleFields: playerProjection.visibleFields,
            playerVisible: record.playerVisible === true,
            canEdit: true,
            canManage: true,
            pendingLocal: true,
          });
        });
      }
      return { npcs, canManage: cloud.canManage === true };
    }
  }
  const records = Object.values(storedNpcRecords());
  return {
    canManage,
    npcs: records.filter((record) => canManage || record.playerVisible).map((record) => {
      const playerProjection = projectNpcForPlayer(record.document, record.visibility);
      const projected = canManage
        ? { document: cloneJSON(record.document), visibleFields: playerProjection.visibleFields }
        : playerProjection;
      return {
        id: record.document.id,
        document: projected.document,
        visibleFields: projected.visibleFields,
        ...(canManage ? { visibility: record.visibility || {}, playerVisible: record.playerVisible === true } : {}),
        canEdit: canManage,
        canManage,
      };
    }),
  };
}

export async function createNpc(setup) {
  const records = storedNpcRecords();
  const id = npcId(setup.name, records);
  const response = await fetch("char/template/character.json");
  if (!response.ok) throw new Error("Could not load the NPC template.");
  const template = await response.json();
  const document = setup.importedCharacter
    ? applyImportedCharacterSetup(template, { ...setup, id })
    : applyNewCharacterSetup(template, { ...setup, id });
  const record = { document, visibility: defaultNpcVisibility(), playerVisible: false };
  records[id] = cloneJSON(record);
  writeJSON(NPCS_STORAGE_KEY, records);
  if (isLocalRuntimeHost()) return { record, cloudSaved: true };
  try {
    await writeCloudJSON(`api/npcs/${encodeURIComponent(id)}`, record);
    return { record, cloudSaved: true };
  } catch (cloudError) {
    return { record, cloudSaved: false, cloudError };
  }
}

export async function createBuiltNpc(value, {
  canManage = campaignCanManage,
  cloudWrite = writeCloudJSON,
  localOnly = isLocalRuntimeHost(),
} = {}) {
  if (!await canManage()) throw new Error("Campaign DM access required.");
  const document = normalizeCharacterDocument(value);
  if (!document.id || document.build.mode !== "rules" || document.build.status !== "complete") {
    throw new Error("Complete rules-built NPC with a valid ID is required.");
  }
  const records = storedNpcRecords();
  if (records[document.id]) throw new Error("That NPC ID already exists in this campaign.");
  const record = { document: cloneJSON(document), visibility: defaultNpcVisibility(), playerVisible: false };
  records[document.id] = cloneJSON(record);
  writeJSON(NPCS_STORAGE_KEY, records);
  if (localOnly) return { record, id: document.id, document: cloneJSON(document), cloudSaved: true };
  try {
    await cloudWrite(`api/npcs/${encodeURIComponent(document.id)}`, { ...record, createOnly: true });
    return { record, id: document.id, document: cloneJSON(document), cloudSaved: true };
  } catch (cloudError) {
    if (cloudError?.status === 409) {
      const recovery = storedNpcRecords();
      delete recovery[document.id];
      writeJSON(NPCS_STORAGE_KEY, recovery);
      throw cloudError;
    }
    return { record, id: document.id, document: cloneJSON(document), cloudSaved: false, cloudError };
  }
}

export async function setNpcPlayerVisible(record, playerVisible) {
  if (!isLocalRuntimeHost()) {
    await writeCloudJSON(`api/npcs/${encodeURIComponent(record.id)}/visibility`, { playerVisible });
  }
  const records = storedNpcRecords();
  if (records[record.id]) records[record.id].playerVisible = playerVisible;
  writeJSON(NPCS_STORAGE_KEY, records);
}

export async function removeNpc(record) {
  if (!isLocalRuntimeHost()) await writeCloudJSON(`api/npcs/${encodeURIComponent(record.id)}`, undefined, { method: "DELETE" });
  const records = storedNpcRecords();
  delete records[record.id];
  writeJSON(NPCS_STORAGE_KEY, records);
}
