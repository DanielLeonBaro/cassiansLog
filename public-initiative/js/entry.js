// Boots the Public Initiative page and mounts its shared chrome and controllers.
import { mountSiteHeader } from "../../shared/js/site-header.js";
import { initializeTheme } from "../../shared/js/theme.js";
import { initializePublicInitiative } from "./page.js";

mountSiteHeader({ activePage: "public-initiative" });
initializeTheme();
initializePublicInitiative();
