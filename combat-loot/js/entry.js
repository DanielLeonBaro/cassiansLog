// Boots the Combat and Loot page and mounts its shared chrome and controllers.
import { mountSiteHeader } from "../../shared/js/site-header.js";
import { initializeTheme } from "../../shared/js/theme.js";
import { initializeDiceRoller } from "../../shared/js/dice/index.js";
import { initializeCombatLoot } from "./page.js";

mountSiteHeader({ activePage: "combat-loot" });
initializeTheme();
initializeDiceRoller();
initializeCombatLoot();
