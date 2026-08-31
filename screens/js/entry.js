// Boots the Player and DM Screen page and mounts its shared chrome and controllers.
import { initializeDiceRoller } from "../../shared/js/dice/index.js";
import { mountSiteHeader } from "../../shared/js/site-header.js";
import { initializeTheme } from "../../shared/js/theme.js";
import { initializeScreen } from "./page.js";

const kind = document.body.dataset.screenKind === "dm" ? "dm" : "player";
mountSiteHeader({ activePage: `${kind}-screen` });
initializeTheme();
initializeDiceRoller();
await initializeScreen(kind);
