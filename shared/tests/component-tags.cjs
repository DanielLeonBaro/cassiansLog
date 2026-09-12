// Keeps component tag parsing consistent across automated test runners.
const COMPONENT_TAGS = Object.freeze([
  "@admin",
  "@auth",
  "@campaigns",
  "@character-layout",
  "@characters",
  "@combat",
  "@compendium",
  "@core",
  "@initiative",
  "@music",
  "@npcs",
  "@screens",
  "@themes",
  "@wiki",
]);

function parseRequestedTags(args) {
  const requested = new Set(args.filter((argument) => argument.startsWith("@")));
  const unknown = [...requested].filter((tag) => !COMPONENT_TAGS.includes(tag));
  if (unknown.length) {
    throw new Error(`Unknown test tag${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}`);
  }
  return requested;
}

function matchesTags(requested, tags) {
  return requested.size === 0 || requested.has("@core") || tags.some((tag) => requested.has(tag));
}

module.exports = { COMPONENT_TAGS, matchesTags, parseRequestedTags };
