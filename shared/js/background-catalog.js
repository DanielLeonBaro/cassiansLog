// Defines the bundled, theme-aware page backgrounds shown in the appearance picker.
export const DEFAULT_BACKGROUND_ID = "default-squared";
export const REMOVED_BACKGROUND_IDS = Object.freeze([
  "angled-pattern",
  "diagonals",
  "fireflies",
  "floating-waves",
  "parallax-stars",
  "rainbow-background",
  "shooting-stars",
  "squared-moving-pattern",
  "squared-octagons",
]);

function background(id, name, type) {
  return Object.freeze({ id, name, type });
}

export const BACKGROUNDS = Object.freeze([
  background("arcs", "Arcs", "static"),
  background("checkerboard", "Checkerboard", "static"),
  background("chevron", "Chevron", "static"),
  background("circuit-grid", "Circuit Grid", "static"),
  background("cross", "Cross", "static"),
  background("default-squared", "Default Squared", "static"),
  background("diagonal-1", "Diagonal 1", "static"),
  background("diagonal-2", "Diagonal 2", "static"),
  background("diagonal-3", "Diagonal 3", "static"),
  background("diamond", "Diamond", "static"),
  background("dots-grid", "Dots Grid", "static"),
  background("flower", "Flower", "static"),
  background("graph-paper", "Graph Paper", "static"),
  background("graph-paper-dotted", "Graph Paper Dotted", "static"),
  background("horizontal-lines", "Horizontal Lines", "static"),
  background("horizontal-slim-lines", "Horizontal Slim Lines", "static"),
  background("horizontal-wavy-lines", "Horizontal Wavy Lines", "static"),
  background("infinite-circles", "Infinite Circles", "static"),
  background("infinite-wave", "Infinite Wave", "static"),
  background("isometric", "Isometric", "static"),
  background("paper", "Paper", "static"),
  background("paper-thin", "Paper Thin", "static"),
  background("polka-halftone", "Polka Halftone", "static"),
  background("polka-pin", "Polka Pin", "static"),
  background("rhombus", "Rhombus", "static"),
  background("ripple", "Ripple", "static"),
  background("vertical-lines", "Vertical Lines", "static"),
  background("vertical-slim-lines", "Vertical Slim Lines", "static"),
  background("vertical-wavy-lines", "Vertical Wavy Lines", "static"),
  background("wide-diagonal", "Wide Diagonal", "static"),
  background("zigzag", "ZigZag", "static"),
  background("zigzag-3d", "ZigZag 3D", "static"),
].sort((left, right) => left.type.localeCompare(right.type)
  || left.name.localeCompare(right.name, undefined, { sensitivity: "base" })));

export const BACKGROUND_IDS = Object.freeze(BACKGROUNDS.map(({ id }) => id));

export const BACKGROUND_GROUPS = Object.freeze([
  Object.freeze({
    id: "static",
    name: "Static backgrounds",
    backgrounds: Object.freeze(BACKGROUNDS.filter(({ type }) => type === "static")),
  }),
]);

export function normalizeBackgroundId(value) {
  return BACKGROUND_IDS.includes(value) ? value : DEFAULT_BACKGROUND_ID;
}
