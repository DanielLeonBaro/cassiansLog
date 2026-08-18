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

export const sectionConfigReady = fetch("api/settings", { headers: { accept: "application/json" } })
  .then((response) => {
    if (!response.ok) throw new Error(`Could not load dynamic settings (${response.status}).`);
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
    console.warn("Dynamic settings are unavailable; loading bundled section settings.", error);
    return fetch(new URL("../config/sections.json", import.meta.url))
      .then((response) => response.ok ? response.json() : {})
      .then((config) => {
        sections = config?.sections && typeof config.sections === "object" ? config.sections : {};
        applySectionVisibility();
        return sections;
      })
      .catch((fallbackError) => {
        console.warn("Bundled section settings are also unavailable; showing all links.", fallbackError);
        applySectionVisibility();
        return sections;
      });
  });
