// Verifies cursor placement and selection wrapping for shared Markdown editors.
import assert from "node:assert/strict";
import {
  COMPACT_MARKDOWN_FORMATS,
  markdownEdit,
  markdownToolbarMarkup,
} from "../js/markdown-toolbar.js";

assert.deepEqual(markdownEdit("", 0, 0, "bold"), {
  value: "****",
  selectionStart: 2,
  selectionEnd: 2,
});
assert.deepEqual(markdownEdit("old text", 0, 3, "italic"), {
  value: "*old* text",
  selectionStart: 1,
  selectionEnd: 4,
});
assert.deepEqual(markdownEdit("Intro\nNext", 8, 8, "heading"), {
  value: "Intro\n## Next",
  selectionStart: 11,
  selectionEnd: 11,
});
assert.deepEqual(markdownEdit("one\ntwo", 0, 7, "bullets"), {
  value: "- one\n- two",
  selectionStart: 2,
  selectionEnd: 11,
});
assert.deepEqual(markdownEdit("", 0, 0, "link"), {
  value: "[](https://)",
  selectionStart: 1,
  selectionEnd: 1,
});
assert.deepEqual(markdownEdit("Breugaire", 0, 9, "mention"), {
  value: "[[Breugaire]]",
  selectionStart: 2,
  selectionEnd: 11,
});
assert.deepEqual(markdownEdit("", 0, 0, "divider"), {
  value: "---\n",
  selectionStart: 4,
  selectionEnd: 4,
});

const compactToolbar = markdownToolbarMarkup("Cell formatting", COMPACT_MARKDOWN_FORMATS);
assert.match(compactToolbar, /aria-label="Cell formatting"/);
assert.match(compactToolbar, /data-markdown-format="bold"/);
assert.doesNotMatch(compactToolbar, /data-markdown-format="image"/);
assert.doesNotMatch(compactToolbar, /data-markdown-format="mention"/);

console.log("Markdown toolbar editing tests passed.");
