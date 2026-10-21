import { renderButton, renderBadge, renderState, createDialogController, createDrawerController, createMenuController } from "../components.js";
import { initializeTheme } from "../../js/theme.js";
import { uiPreferencesReady } from "../runtime.js";

initializeTheme();
document.querySelector("[data-gallery-buttons]").innerHTML = ["primary", "secondary", "ghost", "danger"].map((variant) => renderButton({ label: variant, variant })).join("") + renderButton({ label: "Disabled", disabled: true });
document.querySelector("[data-gallery-badges]").innerHTML = ["neutral", "success", "warning", "danger"].map((tone) => renderBadge({ label: tone, tone })).join("");
document.querySelector("[data-gallery-states]").innerHTML = ["loading", "empty", "error"].map((kind) => renderState({ title: `${kind} state`, message: "Feature-specific feedback uses the same visual language.", kind })).join("");
document.querySelector("[data-gallery-density]").addEventListener("change", (event) => { document.documentElement.dataset.density = event.target.value; });
void uiPreferencesReady.then(() => { document.querySelector("[data-gallery-density]").value = document.documentElement.dataset.density; });
for (const kind of ["dialog", "drawer"]) {
  const root = document.getElementById(`gallery-${kind}`);
  const button = document.querySelector(`[data-gallery-${kind}]`);
  const controller = (kind === "drawer" ? createDrawerController : createDialogController)(root, { returnFocus: button });
  button.addEventListener("click", controller.open);
  root.querySelector("[data-gallery-close]").addEventListener("click", controller.close);
}
createMenuController(document.querySelector("[data-gallery-menu-button]"), document.getElementById("gallery-menu"));
const tabs = [...document.querySelectorAll('[role="tab"]')];
function activate(index) {
  tabs.forEach((tab, i) => {
    tab.setAttribute("aria-selected", String(index === i));
    tab.tabIndex = index === i ? 0 : -1;
    document.getElementById(tab.getAttribute("aria-controls")).hidden = index !== i;
  });
  tabs[index].focus();
}
tabs.forEach((tab, i) => {
  tab.addEventListener("click", () => activate(i));
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    activate(event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (i + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length);
  });
});
