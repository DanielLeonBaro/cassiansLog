// Boots the Compendium page and mounts its shared chrome and controllers.
import { initializeCompendium } from "./page.js";
import { mountSiteHeader } from "../../shared/js/site-header.js";
import { initializeTheme } from "../../shared/js/theme.js";
import { initializeDiceRoller } from "../../shared/js/dice/index.js";

mountSiteHeader({ activePage: "compendium" });
initializeTheme();
initializeDiceRoller();
initializeCompendium();
