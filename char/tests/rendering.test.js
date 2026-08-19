import assert from "node:assert/strict";
import { escapeHTML as sharedEscapeHTML } from "../../shared/js/text.js";
import {
  escapeAttribute,
  escapeHTML,
  sanitizeIdentifier,
} from "../js/tracker/rendering.js";

assert.equal(escapeHTML, sharedEscapeHTML, "Tracker rendering should re-export shared HTML escaping.");
assert.equal(sanitizeIdentifier("slot:level 1/2"), "slot-level-1-2");
assert.equal(sanitizeIdentifier("safe_ID-2"), "safe_ID-2");
assert.equal(sanitizeIdentifier(null), "");
assert.equal(escapeAttribute, sanitizeIdentifier, "The legacy export must preserve sanitizer output.");

console.log("Character rendering helper tests passed.");
