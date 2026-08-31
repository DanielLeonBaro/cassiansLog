// Verifies combat dialog controller.
import assert from "node:assert/strict";
import { createCombatDialogController } from "../js/dialog-controller.js";

function classes(initial = []) {
  const values = new Set(initial);
  return {
    add: (...names) => names.forEach((name) => values.add(name)),
    contains: (name) => values.has(name),
    remove: (...names) => names.forEach((name) => values.delete(name)),
  };
}

function element(tagName = "DIV") {
  const attributes = new Set();
  return {
    tagName,
    classList: classes(["hidden"]),
    hasAttribute: (name) => attributes.has(name),
    removeAttribute: (name) => attributes.delete(name),
    setAttribute: (name) => attributes.add(name),
  };
}

let restoredFocus = false;
let initialFocused = false;
const dialog = element();
const content = element("MAIN");
const documentRoot = {
  activeElement: { isConnected: true, focus: () => { restoredFocus = true; } },
  body: { children: [content, dialog], classList: classes() },
};
const controller = createCombatDialogController({
  dialogs: [dialog],
  documentRoot,
  setTimeoutFn: (callback) => callback(),
});

controller.open(dialog, { focus: () => { initialFocused = true; } });
assert.equal(dialog.classList.contains("hidden"), false);
assert.equal(content.hasAttribute("inert"), true);
assert.equal(initialFocused, true);

controller.close(dialog);
assert.equal(dialog.classList.contains("hidden"), true);
assert.equal(content.hasAttribute("inert"), false);
assert.equal(documentRoot.body.classList.contains("overflow-hidden"), false);
assert.equal(restoredFocus, true);

console.log("Combat dialog-controller tests passed.");
