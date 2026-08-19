export function createCombatDialogController({
  dialogs,
  documentRoot = document,
  setTimeoutFn = setTimeout,
}) {
  const previousFocus = new WeakMap();
  const previouslyInert = new Map();

  function open(dialog, initialFocus) {
    previousFocus.set(dialog, documentRoot.activeElement);
    [...documentRoot.body.children].forEach((element) => {
      if (element === dialog || element.tagName === "SCRIPT") return;
      previouslyInert.set(element, element.hasAttribute("inert"));
      element.setAttribute("inert", "");
    });
    dialog.classList.remove("hidden");
    dialog.classList.add("flex");
    documentRoot.body.classList.add("overflow-hidden");
    setTimeoutFn(() => initialFocus?.focus(), 0);
  }

  function close(dialog) {
    dialog.classList.add("hidden");
    dialog.classList.remove("flex");
    if (!dialogs.some((item) => !item.classList.contains("hidden"))) {
      documentRoot.body.classList.remove("overflow-hidden");
      previouslyInert.forEach((wasInert, element) => {
        if (!wasInert) element.removeAttribute("inert");
      });
      previouslyInert.clear();
    }
    const returnFocus = previousFocus.get(dialog);
    if (returnFocus?.isConnected) returnFocus.focus();
    previousFocus.delete(dialog);
  }

  return { close, open };
}
