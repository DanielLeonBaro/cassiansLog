import { initializeCompendium } from "../compendium.js";
import { mountSiteHeader } from "../shared/site-header.js";
import { initializeTheme } from "../shared/theme.js";

mountSiteHeader({ activePage: "compendium" });
initializeTheme();
initializeCompendium();
