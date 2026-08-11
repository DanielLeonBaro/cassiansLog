import { initializeCompendium } from "../compendium.js";
import { mountSiteHeader } from "../shared/site-header.js";
import { initializeTheme } from "../shared/theme.js";
import { initializeDiceRoller } from "../features/dice/index.js";

mountSiteHeader({ activePage: "compendium" });
initializeTheme();
initializeDiceRoller();
initializeCompendium();
