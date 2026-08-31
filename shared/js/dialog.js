// Provides accessible modal lifecycle, focus trapping, and focus restoration.
export function createDialogController(element, {
  form,
  initialFocus,
  returnFocus,
  beforeClose,
  onClose,
} = {}) {
  let previousFocus = null;
  let closing = false;

  function resolveTarget(target) {
    return typeof target === "function" ? target() : target;
  }

  function focusableElements() {
    return [...element.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )].filter((candidate) => (
      !candidate.hidden &&
      !candidate.closest("[hidden]") &&
      candidate.getClientRects().length > 0 &&
      candidate.getAttribute("aria-hidden") !== "true"
    ));
  }

  function open() {
    previousFocus = document.activeElement;
    element.classList.remove("hidden");
    element.classList.add("flex");
    document.body.classList.add("overflow-hidden");
    queueMicrotask(() => (resolveTarget(initialFocus) || focusableElements()[0])?.focus());
  }

  function forceClose(reason = "close") {
    element.classList.add("hidden");
    element.classList.remove("flex");
    document.body.classList.remove("overflow-hidden");
    form?.reset();
    onClose?.(reason);
    (resolveTarget(returnFocus) || previousFocus)?.focus?.();
    return true;
  }

  async function close(reason = "close") {
    if (reason instanceof Event) {
      reason.preventDefault();
      reason = "control";
    }
    if (element.classList.contains("hidden") || closing) return false;
    closing = true;
    try {
      if (beforeClose && await beforeClose(reason) === false) return false;
      return forceClose(reason);
    } finally {
      closing = false;
    }
  }

  element.addEventListener("click", (event) => {
    if (event.target === element) close("backdrop");
  });
  element.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close("escape");
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = focusableElements();
    if (!focusable.length) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  return { open, close, forceClose };
}
