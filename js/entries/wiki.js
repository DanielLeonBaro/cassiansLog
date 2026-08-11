import { initializeWiki } from "../wiki.js";
import { mountSiteHeader } from "../shared/site-header.js";
import { initializeTheme } from "../shared/theme.js";
import { initializeDiceRoller } from "../features/dice/index.js";

mountSiteHeader({ activePage: "wiki" });
initializeTheme();
initializeDiceRoller();
initializeWiki();
