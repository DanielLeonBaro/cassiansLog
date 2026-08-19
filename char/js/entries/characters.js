import { initializeCharacterArchive } from "../archive/index.js";
import { enableLocalCharacterRoutes } from "../archive/local-routes.js";

await enableLocalCharacterRoutes();
initializeCharacterArchive();
