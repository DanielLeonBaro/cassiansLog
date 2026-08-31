// Handles themes API routing, validation, authorization, and D1 persistence.
import { json } from "../http.js";
import { loadThemeCatalog } from "../themes.js";

export async function themeCatalogRoute(env) {
  const catalog = await loadThemeCatalog(env);
  return json(catalog);
}
