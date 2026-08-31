// Verifies character load-error rendering.
import assert from "node:assert/strict";
import { renderCharacterLoadError } from "../js/load-error.js";

function render(message, showBackLink = false) {
  const errorElement = { textContent: "" };
  const documentRoot = {
    body: { innerHTML: "" },
    querySelector(selector) {
      assert.equal(selector, "[data-character-load-error]");
      return errorElement;
    },
  };
  renderCharacterLoadError(message, { documentRoot, showBackLink });
  return { markup: documentRoot.body.innerHTML, text: errorElement.textContent };
}

const hostileMessage = '<img src=x onerror="alert(1)">';
const standalone = render(hostileMessage);
assert.equal(standalone.text, hostileMessage);
assert.ok(!standalone.markup.includes(hostileMessage));
assert.ok(!standalone.markup.includes("Back to characters"));

const routed = render("Could not load.", true);
assert.equal(routed.text, "Could not load.");
assert.ok(routed.markup.includes("Back to characters"));

console.log("Character load-error rendering tests passed.");
