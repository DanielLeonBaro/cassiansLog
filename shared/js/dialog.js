export function createDialogController(element, { form, initialFocus } = {}) {
  function open() {
    element.classList.remove("hidden");
    element.classList.add("flex");
    document.body.classList.add("overflow-hidden");
    initialFocus?.focus();
  }

  function close() {
    element.classList.add("hidden");
    element.classList.remove("flex");
    document.body.classList.remove("overflow-hidden");
    form?.reset();
  }

  element.addEventListener("click", (event) => {
    if (event.target === element) close();
  });
  return { open, close };
}
