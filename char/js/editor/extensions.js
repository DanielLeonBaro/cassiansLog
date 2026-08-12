const extensions = new Map();
const listeners = new Set();

export function registerCharacterEditorExtension(extension) {
  if (!extension?.id || typeof extension.id !== "string") {
    throw new TypeError("Character editor extensions require a string id.");
  }
  if (extensions.has(extension.id)) return;
  extensions.set(extension.id, extension);
  listeners.forEach((listener) => listener(extension));
}

export function subscribeCharacterEditorExtensions(listener) {
  extensions.forEach((extension) => listener(extension));
  listeners.add(listener);
  return () => listeners.delete(listener);
}
