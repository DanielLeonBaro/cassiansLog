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
      <main class="container py-5">
        <div class="alert alert-danger">${message}</div>
        <a class="btn btn-outline-secondary" href="./">Back to characters</a>
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
