// Provides accessible full-image viewing with keyboard and focus handling.
export function createImageModalController({
  closeButton,
  documentRoot = document,
  imageElement,
  modal,
}) {
  let returnFocus = null;

  function open(image) {
    returnFocus = documentRoot.activeElement;
    imageElement.src = image.currentSrc || image.src;
    imageElement.alt = image.alt || "Reference image";
    modal.classList.remove("hidden");
    documentRoot.body.classList.add("overflow-hidden");
    closeButton.focus();
  }

  function close() {
    if (modal.classList.contains("hidden")) return;
    modal.classList.add("hidden");
    imageElement.removeAttribute("src");
    documentRoot.body.classList.remove("overflow-hidden");
    returnFocus?.focus?.();
    returnFocus = null;
  }

  return { close, open };
}
