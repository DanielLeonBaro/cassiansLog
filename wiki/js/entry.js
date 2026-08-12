import { initializeWiki } from "./page.js";
import { mountSiteHeader } from "../../shared/js/site-header.js";
import { initializeTheme } from "../../shared/js/theme.js";
import { initializeDiceRoller } from "../../shared/js/dice/index.js";

mountSiteHeader({ activePage: "wiki" });
initializeTheme();
initializeDiceRoller();
await initializeWiki();
