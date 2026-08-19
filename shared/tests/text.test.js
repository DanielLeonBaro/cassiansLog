import assert from "node:assert/strict";
import {
  clone,
  cloneJSON,
  escapeAttribute,
  escapeHTML,
} from "../js/text.js";

assert.equal(
  escapeHTML(`Cassian's <blade> & "shield"`),
  "Cassian&#039;s &lt;blade&gt; &amp; &quot;shield&quot;",
);
assert.equal(escapeHTML(null), "");
assert.equal(escapeAttribute("a`b&c"), "a&#096;b&amp;c");

const original = {
  date: new Date("2026-08-19T00:00:00.000Z"),
  omitted: undefined,
  nested: { items: [{ name: "Potion" }] },
};
const copied = cloneJSON(original);
assert.deepEqual(copied, {
  date: "2026-08-19T00:00:00.000Z",
  nested: { items: [{ name: "Potion" }] },
});
copied.nested.items[0].name = "Changed";
assert.equal(original.nested.items[0].name, "Potion");
assert.equal(clone, cloneJSON, "The legacy clone export must retain JSON-clone semantics.");

console.log("Shared text and JSON clone tests passed.");
