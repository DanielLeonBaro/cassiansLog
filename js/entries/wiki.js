import { initializeWiki } from "../wiki.js";
import { mountSiteHeader } from "../shared/site-header.js";
import { initializeTheme } from "../shared/theme.js";

mountSiteHeader({ activePage: "wiki" });
initializeTheme();
initializeWiki();
