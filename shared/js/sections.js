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

export const sectionConfigReady = fetch(new URL("../config/sections.json", import.meta.url))
  .then((response) => {
    if (!response.ok) {
      throw new Error(`Could not load section configuration (${response.status}).`);
    }
    return response.json();
  })
  .then((config) => {
    sections = config?.sections && typeof config.sections === "object"
      ? config.sections
      : {};
    applySectionVisibility();
    return sections;
  })
  .catch((error) => {
    console.warn("Section configuration is unavailable; showing all links.", error);
    applySectionVisibility();
    return sections;
  });
