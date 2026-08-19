import assert from "node:assert/strict";
import { isLocalRuntimeHost } from "../js/runtime-host.js";

for (const hostname of ["localhost", "LOCALHOST", "127.0.0.1", "::1", "[::1]"]) {
  assert.equal(isLocalRuntimeHost(hostname), true, `${hostname} should use local runtime support.`);
}
for (const hostname of ["", "cassianslog.urhyse.workers.dev", "localhost.example.com"]) {
  assert.equal(isLocalRuntimeHost(hostname), false, `${hostname || "an empty host"} should not be local.`);
}

console.log("Local runtime host tests passed.");
