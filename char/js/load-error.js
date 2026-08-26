export function renderCharacterLoadError(message, {
  documentRoot = document,
  showBackLink = false,
} = {}) {
  const backLink = showBackLink
    ? '<a class="inline-flex items-center justify-center rounded-xl border border-stone-400 bg-white/60 px-4 py-2 text-sm font-bold text-stone-700 shadow-sm transition hover:border-blood-500 hover:text-blood-500 dark:border-white/20 dark:bg-white/5 dark:text-stone-200" href="char/">Back to characters</a>'
    : "";
  const errorMargin = showBackLink ? "mb-4 " : "";
  documentRoot.body.innerHTML = `
    <main class="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div data-character-load-error class="${errorMargin}rounded-2xl border border-danger-500/30 bg-danger-500/10 p-4 text-danger-600 dark:text-red-300"></div>
      ${backLink}
    </main>`;
  documentRoot.querySelector("[data-character-load-error]").textContent = String(message ?? "");
}
