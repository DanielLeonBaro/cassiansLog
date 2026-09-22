import path from "node:path";
import { publicationFolder } from "./source-name.js";
import { safeSegment, sha256, writeAtomic } from "./paths.js";

export const LICENSE_STATUSES = Object.freeze(["unknown", "private-use-only", "permission-granted", "open-license", "redistribution-restricted"]);

export function assertLicenseStatus(value) {
  if (!LICENSE_STATUSES.includes(value)) throw new Error(`Unsupported license status: ${value || "(missing)"}`);
  return value;
}

export function stableRecordId(record) {
  return `wikidot-${record.ruleset}-${record.type}-${safeSegment(record.name)}-${sha256(record.sourcePageUrl).slice(0, 12)}`;
}

export async function writeNormalizedRecord(outputDir, value, { strict = false } = {}) {
  const record = { ...value, id: value.id || stableRecordId(value) };
  assertLicenseStatus(record.licenseStatus);
  if (strict && !record.publication) throw new Error(`Unknown publication for ${record.sourcePageUrl}`);
  if (strict && record.licenseStatus === "unknown") throw new Error(`Unknown license status for ${record.sourcePageUrl}`);
  const folder = publicationFolder(record.publication);
  const filePath = path.join(outputDir, "normalized", record.ruleset, folder, record.type, `${safeSegment(record.name)}-${sha256(record.sourcePageUrl).slice(0, 12)}.json`);
  await writeAtomic(filePath, `${JSON.stringify(record, null, 2)}\n`);
  return { record, filePath };
}
