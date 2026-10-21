import { applyUiPage } from "./runtime.js";
import { enhanceComponents } from "./components.js";

applyUiPage(document.body.dataset.gcPage);
enhanceComponents();
