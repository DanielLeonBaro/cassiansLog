import assert from "node:assert/strict";
import { createWikiImageModalController } from "../js/image-modal.js";

function classList(initial = []) {
  const values = new Set(initial);
  return {
    add: (...names) => names.forEach((name) => values.add(name)),
    contains: (name) => values.has(name),
    remove: (...names) => names.forEach((name) => values.delete(name)),
  };
}

let restoredFocus = false;
let closeFocused = false;
const modal = { classList: classList(["hidden"]) };
const imageElement = {
  alt: "",
  src: "",
  removeAttribute(name) {
    if (name === "src") this.src = "";
  },
};
const documentRoot = {
  activeElement: { focus: () => { restoredFocus = true; } },
  body: { classList: classList() },
};
const controller = createWikiImageModalController({
  closeButton: { focus: () => { closeFocused = true; } },
  documentRoot,
  imageElement,
  modal,
});

controller.open({ currentSrc: "banner-large.jpg", src: "banner.jpg", alt: "Castle" });
assert.equal(imageElement.src, "banner-large.jpg");
assert.equal(imageElement.alt, "Castle");
assert.equal(modal.classList.contains("hidden"), false);
assert.equal(documentRoot.body.classList.contains("overflow-hidden"), true);
assert.equal(closeFocused, true);

controller.close();
assert.equal(imageElement.src, "");
assert.equal(modal.classList.contains("hidden"), true);
assert.equal(restoredFocus, true);

console.log("Wiki image-modal tests passed.");
