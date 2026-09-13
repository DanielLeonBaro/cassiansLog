// Mounts the shared dice dialog and connects formula input to rendered results.
import { appendDieToFormula, rollDiceFormula } from "./formula.js";
import {
  clearDiceHistory,
  loadDiceHistory,
  normalizeDiceHistory,
  recordDiceHistory,
} from "./history.js";

const buttonClass = "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-stone-400 bg-white/70 text-stone-700 shadow-sm transition hover:border-blood-500 hover:text-blood-500 dark:border-white/20 dark:bg-white/5 dark:text-stone-200";
let activeDiceRoller = null;

function resultFragment(result) {
  const fragment = document.createDocumentFragment();
  result.parts.forEach((part) => {
    const span = document.createElement("span");
    span.textContent = part.text;
    if (part.tone === "minimum") span.className = "font-bold text-red-600 dark:text-red-400";
    if (part.tone === "maximum") span.className = "font-bold text-emerald-600 dark:text-emerald-400";
    fragment.appendChild(span);
  });
  const equals = document.createElement("span");
  equals.className = "font-bold";
  equals.textContent = ` = ${result.total}`;
  fragment.appendChild(equals);
  return fragment;
}

export function initializeDiceRoller({ historyKey = "" } = {}) {
  if (activeDiceRoller) {
    activeDiceRoller.configure({ historyKey });
    return activeDiceRoller;
  }
  const slot = document.getElementById("page-header-actions");
  if (!slot || document.getElementById("dice-roller-toggle")) return null;
  slot.innerHTML = `<button id="dice-roller-toggle" type="button" class="${buttonClass}" aria-label="Open dice roller" title="Dice roller"><i class="bi bi-dice-6-fill" aria-hidden="true"></i></button>`;

  const overlay = document.createElement("div");
  overlay.id = "dice-roller-dialog";
  overlay.className = "fixed inset-0 z-[70] hidden items-center justify-center bg-ink/80 p-4 backdrop-blur-sm";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "dice-roller-title");
  overlay.innerHTML = `
    <div class="w-full max-w-xl overflow-hidden rounded-2xl border border-stone-300 bg-parchment shadow-2xl dark:border-white/15 dark:bg-stone-900">
      <div class="flex items-center justify-between border-b border-stone-300 px-5 py-4 dark:border-white/10">
        <h2 id="dice-roller-title" class="font-display text-xl font-bold"><i class="bi bi-dice-6-fill mr-2 text-blood-500"></i>Dice roller</h2>
        <button id="dice-roller-close" type="button" class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-stone-300 transition hover:border-blood-500 hover:text-blood-500 dark:border-white/15" aria-label="Close dice roller"><i class="bi bi-x-lg"></i></button>
      </div>
      <form id="dice-roller-form" class="p-5">
        <label for="dice-formula" class="mb-2 block text-sm font-bold">Formula</label>
        <div class="flex gap-2">
          <input id="dice-formula" name="formula" type="text" autocomplete="off" spellcheck="false" placeholder="2d20+4" class="min-w-0 grow rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-stone-900 shadow-inner outline-none transition focus:border-blood-500 dark:border-white/15 dark:bg-white/5 dark:text-white">
          <button type="submit" class="inline-flex items-center justify-center gap-2 rounded-xl border border-blood-500 bg-blood-500 px-4 py-2.5 font-bold text-white shadow-sm transition hover:bg-blood-600"><i class="bi bi-dice-6-fill"></i>Roll</button>
        </div>
        <fieldset class="mt-3">
          <legend class="mb-2 text-xs font-bold text-stone-500 dark:text-stone-400">Add a die</legend>
          <div class="flex flex-wrap gap-2">
            ${[4, 6, 8, 10, 12, 20, 100].map((sides) => `<button type="button" data-die-sides="${sides}" class="inline-flex h-10 min-w-10 items-center justify-center rounded-xl border border-stone-300 bg-white/70 px-2 text-xs font-bold text-stone-700 shadow-sm transition hover:border-blood-500 hover:text-blood-500 dark:border-white/15 dark:bg-white/5 dark:text-stone-200">d${sides}</button>`).join("")}
          </div>
        </fieldset>
        <p class="mt-2 text-xs text-stone-500 dark:text-stone-400">Try 2d20+4 or 2(2d6+4)+1d4+1.</p>
        <p id="dice-roller-error" class="mt-4 hidden rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300" role="alert"></p>
        <div id="dice-roller-result" class="mt-4 hidden rounded-xl border border-stone-300 bg-white/70 p-4 text-lg dark:border-white/15 dark:bg-white/5" aria-live="polite"></div>
        <section class="mt-5 border-t border-stone-300 pt-4 dark:border-white/15" aria-labelledby="dice-history-title">
          <div class="flex items-center justify-between gap-3">
            <h3 id="dice-history-title" class="font-display font-bold">Roll history</h3>
            <button id="dice-history-clear" type="button" class="hidden rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs font-bold text-stone-600 transition hover:border-danger-500 hover:text-danger-500 dark:border-white/15 dark:text-stone-300">Clear</button>
          </div>
          <p id="dice-history-empty" class="mt-3 text-sm text-stone-500 dark:text-stone-400">No rolls yet.</p>
          <ol id="dice-history-list" class="mt-3 max-h-64 space-y-2 overflow-y-auto" aria-live="polite"></ol>
        </section>
      </form>
    </div>`;
  document.body.appendChild(overlay);

  const input = overlay.querySelector("#dice-formula");
  const result = overlay.querySelector("#dice-roller-result");
  const error = overlay.querySelector("#dice-roller-error");
  const historyList = overlay.querySelector("#dice-history-list");
  const historyEmpty = overlay.querySelector("#dice-history-empty");
  const historyClear = overlay.querySelector("#dice-history-clear");
  let activeHistoryKey = "";
  let history = [];

  function renderHistory() {
    historyList.replaceChildren(...history.map((entry) => {
      const item = document.createElement("li");
      item.className = "rounded-xl border border-stone-300 bg-white/60 p-3 dark:border-white/10 dark:bg-white/5";
      const heading = document.createElement("div");
      heading.className = "flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1";
      const label = document.createElement("strong");
      label.className = "text-sm";
      label.textContent = entry.label;
      const formula = document.createElement("code");
      formula.className = "text-xs text-stone-500 dark:text-stone-400";
      formula.textContent = entry.formula;
      heading.append(label, formula);
      const equation = document.createElement("div");
      equation.className = "mt-1 text-sm";
      equation.append(resultFragment(entry));
      item.append(heading, equation);
      return item;
    }));
    historyEmpty.classList.toggle("hidden", history.length > 0);
    historyClear.classList.toggle("hidden", history.length === 0);
  }

  function configure({ historyKey: nextHistoryKey = "" } = {}) {
    activeHistoryKey = String(nextHistoryKey || "");
    try {
      history = loadDiceHistory(activeHistoryKey);
    } catch (historyError) {
      console.warn("Could not load dice history.", historyError);
      history = [];
    }
    renderHistory();
  }

  const open = () => {
    overlay.classList.remove("hidden");
    overlay.classList.add("flex");
    document.body.classList.add("overflow-hidden");
    input.focus();
  };
  const close = () => {
    overlay.classList.add("hidden");
    overlay.classList.remove("flex");
    document.body.classList.remove("overflow-hidden");
  };

  function roll(formula, label = "") {
    const normalizedFormula = String(formula || "").replace(/\s+/g, "").trim();
    input.value = normalizedFormula;
    open();
    try {
      const rolled = rollDiceFormula(normalizedFormula);
      const entry = {
        label: String(label || `Dice Roller ${normalizedFormula}`).trim(),
        formula: normalizedFormula,
        total: rolled.total,
        parts: rolled.parts,
        rolledAt: new Date().toISOString(),
      };
      error.classList.add("hidden");
      result.replaceChildren(resultFragment(rolled));
      result.classList.remove("hidden");
      try {
        history = activeHistoryKey
          ? recordDiceHistory(activeHistoryKey, entry)
          : normalizeDiceHistory([entry, ...history]);
      } catch (historyError) {
        console.warn("Could not save dice history.", historyError);
        history = normalizeDiceHistory([entry, ...history]);
      }
      renderHistory();
      return rolled;
    } catch (rollError) {
      result.classList.add("hidden");
      error.textContent = rollError.message;
      error.classList.remove("hidden");
      return null;
    }
  }

  slot.querySelector("#dice-roller-toggle").addEventListener("click", open);
  overlay.querySelector("#dice-roller-close").addEventListener("click", close);
  overlay.addEventListener("click", (event) => {
    const dieButton = event.target.closest("[data-die-sides]");
    if (!dieButton) return;
    input.value = appendDieToFormula(input.value, dieButton.dataset.dieSides);
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  });
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  overlay.querySelector("#dice-roller-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const formula = String(input.value || "").replace(/\s+/g, "").trim();
    roll(formula, `Dice Roller ${formula}`);
  });
  historyClear.addEventListener("click", () => {
    try {
      clearDiceHistory(activeHistoryKey);
    } catch (historyError) {
      console.warn("Could not clear dice history.", historyError);
    }
    history = [];
    renderHistory();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay.classList.contains("hidden")) close();
  });
  activeDiceRoller = { configure, open, close, roll };
  configure({ historyKey });
  return activeDiceRoller;
}
