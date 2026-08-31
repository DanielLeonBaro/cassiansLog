// Applies runtime section visibility to static and dynamically rendered links.
import { runtimeSettingsReady } from "./settings.js";

let sections = {};

export function isSectionVisible(section) {
  return sections[section] !== false;
}

export function applySectionVisibility(root = document) {
  const elements = root.matches?.("[data-section-link]")
    ? [root, ...root.querySelectorAll("[data-section-link]")]
    : [...root.querySelectorAll("[data-section-link]")];
  elements.forEach((element) => {
    const hidden = !isSectionVisible(element.dataset.sectionLink);
    element.hidden = hidden;
    if (hidden) element.style.setProperty("display", "none", "important");
    else element.style.removeProperty("display");
  });
}

export const sectionConfigReady = runtimeSettingsReady
  .then((config) => {
    sections = config.sections;
    applySectionVisibility();
    return sections;
  });
