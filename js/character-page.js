(function () {
  const loaderScript = document.currentScript;
  const characterName = loaderScript?.dataset.character;
  const trackerURL = new URL("../tracker.html", window.location.href);

  function loadScript(source) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = source;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Could not load ${source}`));
      document.body.appendChild(script);
    });
  }

  function showError(message) {
    document.body.innerHTML = `
      <main class="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div class="mb-4 rounded-2xl border border-blood-500/30 bg-blood-500/10 p-4 text-blood-600 dark:text-red-300">${message}</div>
        <a class="inline-flex items-center justify-center rounded-xl border border-stone-400 bg-white/60 px-4 py-2 text-sm font-bold text-stone-700 shadow-sm transition hover:border-blood-500 hover:text-blood-500 dark:border-white/20 dark:bg-white/5 dark:text-stone-200" href="./">Back to characters</a>
      </main>`;
  }

  async function loadCharacterPage() {
    if (!characterName || !/^[a-z0-9-]+$/i.test(characterName)) {
      showError("This character route is invalid.");
      return;
    }

    try {
      const response = await fetch(trackerURL);
      if (!response.ok) throw new Error(`Could not load the tracker layout (${response.status}).`);

      const markup = await response.text();
      const trackerDocument = new DOMParser().parseFromString(markup, "text/html");
      trackerDocument.body.querySelectorAll("script").forEach((script) => script.remove());

      document.body.className = trackerDocument.body.className;
      document.body.id = trackerDocument.body.id;
      document.body.innerHTML = trackerDocument.body.innerHTML;

      await loadScript(`data/characters/${characterName}.js`);
      if (!window.character) throw new Error("The character data is missing.");
      await loadScript("js/script.js");
    } catch (error) {
      console.error("Could not load character page:", error);
      showError(error.message);
    }
  }

  loadCharacterPage();
})();
