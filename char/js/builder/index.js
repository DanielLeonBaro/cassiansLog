// Coordinates the accessible Character Builder shell and local-first draft navigation.
import {
  CHARACTER_BUILDER_STEPS,
  adjacentCharacterBuilderStep,
  characterBuilderStepStates,
  createCharacterBuildDraft,
  latestCharacterBuildDraft,
  normalizedCharacterBuilderStep,
  resumeCharacterBuilderStep,
} from "./model.js";
import {
  finalizeCharacterBuildDraft,
  saveCharacterBuildDraft,
  storedCharacterBuildDrafts,
} from "./draft-repository.js";
import { loadCharacterBuilderCatalog } from "./catalog-provider.js";
import { applyBuilderHomePreferences, previewCharacterRulesetChange } from "./home-model.js";
import { renderCharacterBuilderHome } from "./home.js";
import {
  applyBuilderClassLevel,
  applyBuilderRootSelection,
  applyBuilderRuleSelection,
  applyBuilderSubclassSelection,
} from "./choice-model.js";
import { renderCharacterBuilderChoiceStep } from "./choice-step.js";
import { evaluateCharacterBuild } from "../rules/evaluator.js";
import {
  abilityScoreValidation,
  applyBuilderAbilityMethod,
  applyBuilderAbilityScore,
  rollBuilderAbilityScores,
} from "./ability-model.js";
import { renderCharacterBuilderAbilities } from "./abilities.js";
import {
  addBuilderInventoryItem,
  applyBuilderCurrency,
  applyBuilderEquipmentMethod,
  equipmentStepValidation,
  removeBuilderInventoryItem,
  updateBuilderInventoryQuantity,
} from "./equipment-model.js";
import { renderCharacterBuilderEquipment } from "./equipment.js";
import { applyBuilderDescription, descriptionStepValidation } from "./description-model.js";
import { renderCharacterBuilderDescription } from "./description.js";
import { applyBuilderSpellSelection, builderSpellState } from "./spell-model.js";
import { prepareCharacterBuildFinalization } from "./review-model.js";
import { renderCharacterBuilderReview } from "./review.js";
import { campaignPagePath } from "../../../shared/js/campaign-context.js";

const stepCopy = {
  home: "Choose how rules and source material apply to this character.",
  class: "Choose class levels, subclasses, and class feature options.",
  background: "Choose a background and its available options.",
  species: "Choose a species or race and its available options.",
  abilities: "Set the six ability scores using an available method.",
  equipment: "Choose starting gear and organize carried equipment.",
  description: "Add identity, appearance, story, and personal details.",
  review: "Review required choices, warnings, manual content, and overrides.",
};

const stateClasses = {
  complete: "border-green-600/40 bg-green-500/10 text-green-700 dark:text-green-300",
  incomplete: "border-amber-600/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  warning: "border-sky-600/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  blocked: "border-stone-400/50 bg-stone-500/10 text-stone-600 dark:text-stone-300",
};

function draftId() {
  const random = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `draft-${random}`;
}

function labelForStep(stepId) {
  return CHARACTER_BUILDER_STEPS.find(({ id }) => id === stepId)?.label || "Home";
}

export function initializeCharacterBuilderShell({
  saveDraft = saveCharacterBuildDraft,
  readDrafts = storedCharacterBuildDrafts,
  createDraftId = draftId,
  finalizeDraft = finalizeCharacterBuildDraft,
  entityKind = "character",
  cloudDrafts = true,
} = {}) {
  const npcMode = entityKind === "npc";
  const entityLabel = npcMode ? "NPC" : "character";
  const entityWithArticle = npcMode ? "an NPC" : "a character";
  const quickSetup = document.getElementById("quick-setup-panel");
  const shell = document.getElementById("character-builder-shell");
  const entryButton = document.getElementById("detailed-build-entry");
  const entryDescription = document.getElementById("detailed-build-entry-description");
  const progress = document.getElementById("character-builder-progress");
  const stepTitle = document.getElementById("character-builder-step-title");
  const stepDescription = document.getElementById("character-builder-step-description");
  const stepState = document.getElementById("character-builder-step-state");
  const stepContent = document.getElementById("character-builder-step-content");
  const saveStatus = document.getElementById("character-builder-save-status");
  const retryButton = document.getElementById("character-builder-retry");
  const backButton = document.getElementById("character-builder-back");
  const nextButton = document.getElementById("character-builder-next");
  const quickSetupButton = document.getElementById("character-builder-quick-setup");
  const kicker = document.getElementById("dialog-kicker");
  const title = document.getElementById("dialog-title");
  const description = document.getElementById("dialog-description");
  if (!quickSetup || !shell || !entryButton || !progress) return null;

  let activeDraft = null;
  let saving = false;
  let catalogEntries = [];
  let catalogVersion = "";
  let catalogLoading = true;
  let catalogError = "";
  let catalogPromise = null;
  let pendingRuleset = null;
  let finalizing = false;
  let finalizeError = "";
  let evaluatedDocument = null;
  let evaluatedCatalog = null;
  let cachedEvaluation = null;
  let validatedDocument = null;
  let validatedCatalog = null;
  let cachedValidations = null;

  function currentEvaluation() {
    if (!activeDraft || catalogLoading || catalogError) return null;
    if (evaluatedDocument !== activeDraft.document || evaluatedCatalog !== catalogEntries) {
      evaluatedDocument = activeDraft.document;
      evaluatedCatalog = catalogEntries;
      cachedEvaluation = evaluateCharacterBuild({ character: activeDraft.document, catalog: catalogEntries });
    }
    return cachedEvaluation;
  }

  function currentValidations() {
    if (!activeDraft) return {};
    if (validatedDocument !== activeDraft.document || validatedCatalog !== catalogEntries) {
      validatedDocument = activeDraft.document;
      validatedCatalog = catalogEntries;
      cachedValidations = {
        abilityValidation: abilityScoreValidation(activeDraft.document),
        equipmentValidation: equipmentStepValidation(activeDraft.document, catalogEntries),
        descriptionValidation: descriptionStepValidation(activeDraft.document),
        spellValidation: catalogLoading || catalogError ? null : builderSpellState(activeDraft.document, catalogEntries),
      };
    }
    return cachedValidations;
  }

  function refreshEntry() {
    const recent = latestCharacterBuildDraft(readDrafts());
    entryButton.textContent = recent ? "Resume Detailed Build" : "Start Detailed Build";
    entryDescription.textContent = recent
      ? `Continue at ${labelForStep(resumeCharacterBuilderStep(recent))}. Progress is stored in this browser.`
      : `Build a rules-based ${entityLabel} with guided choices, automatic calculations, and visible rule sources.`;
  }

  function renderSaveState({ recovered = false } = {}) {
    const sync = activeDraft?.sync || { state: "pending", error: "" };
    retryButton.hidden = true;
    if (!cloudDrafts) {
      saveStatus.textContent = saving ? "Saving in this browser…" : "Saved in this browser.";
      return;
    }
    if (saving) {
      saveStatus.textContent = "Saved in this browser. Syncing with the cloud…";
      return;
    }
    if (sync.state === "failed") {
      saveStatus.textContent = `Saved in this browser. Cloud sync failed${sync.error ? `: ${sync.error}` : "."}`;
      retryButton.hidden = false;
      return;
    }
    if (sync.state === "pending" && recovered) {
      saveStatus.textContent = "Saved in this browser. Cloud sync was interrupted.";
      retryButton.hidden = false;
      return;
    }
    saveStatus.textContent = "Saved in this browser and synced.";
  }

  function renderProgress() {
    const states = characterBuilderStepStates(activeDraft?.document, {
      evaluation: currentEvaluation(),
      catalog: catalogEntries,
      ...currentValidations(),
    });
    const current = normalizedCharacterBuilderStep(activeDraft?.currentStep);
    progress.replaceChildren(...CHARACTER_BUILDER_STEPS.map((step, index) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      const state = states[step.id];
      button.type = "button";
      button.dataset.builderStep = step.id;
      button.className = `flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${stateClasses[state]}`;
      button.setAttribute("aria-label", `${step.label}: ${state}`);
      if (step.id === current) button.setAttribute("aria-current", "step");
      const label = document.createElement("span");
      label.textContent = `${index + 1}. ${step.label}`;
      const badge = document.createElement("span");
      badge.dataset.builderStepState = state;
      badge.className = "text-[0.68rem] font-bold uppercase tracking-wider";
      badge.textContent = state;
      button.append(label, badge);
      button.addEventListener("click", () => goToStep(step.id));
      item.append(button);
      return item;
    }));

    const state = states[current];
    stepTitle.textContent = labelForStep(current);
    stepDescription.textContent = stepCopy[current];
    stepState.textContent = state;
    stepState.className = `inline-flex rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${stateClasses[state]}`;
    const index = CHARACTER_BUILDER_STEPS.findIndex(({ id }) => id === current);
    backButton.disabled = saving || finalizing || index === 0;
    nextButton.disabled = saving || finalizing || index === CHARACTER_BUILDER_STEPS.length - 1;
  }

  function focusAfterRender(id) {
    if (id) queueMicrotask(() => document.getElementById(id)?.focus());
  }

  function renderStepContent(focusId = "") {
    if (!activeDraft || !stepContent) return;
    const current = normalizedCharacterBuilderStep(activeDraft.currentStep);
    if (["class", "background", "species"].includes(current)) {
      renderCharacterBuilderChoiceStep(stepContent, {
        step: current,
        document: activeDraft.document,
        entries: catalogEntries,
        loading: catalogLoading,
        error: catalogError,
        disabled: saving || finalizing,
        onRootChange: updateRootChoice,
        onLevelChange: updateClassLevel,
        onSubclassChange: updateSubclass,
        onRuleChoiceChange: updateRuleChoice,
        onSpellChange: updateSpells,
      });
      focusAfterRender(focusId);
      return;
    }
    if (current === "abilities") {
      renderCharacterBuilderAbilities(stepContent, {
        document: activeDraft.document,
        disabled: saving || finalizing,
        onMethodChange: updateAbilityMethod,
        onScoreChange: updateAbilityScore,
        onRoll: rollAbilities,
      });
      focusAfterRender(focusId);
      return;
    }
    if (current === "equipment") {
      renderCharacterBuilderEquipment(stepContent, {
        document: activeDraft.document,
        entries: catalogEntries,
        loading: catalogLoading,
        error: catalogError,
        disabled: saving || finalizing,
        onMethodChange: updateEquipmentMethod,
        onCurrencyChange: updateCurrency,
        onAddItem: addInventoryItem,
        onQuantityChange: updateInventoryQuantity,
        onRemoveItem: removeInventoryItem,
      });
      focusAfterRender(focusId);
      return;
    }
    if (current === "description") {
      renderCharacterBuilderDescription(stepContent, {
        document: activeDraft.document,
        disabled: saving || finalizing,
        entityName: npcMode ? "NPC" : "Character",
        onChange: updateDescription,
      });
      focusAfterRender(focusId);
      return;
    }
    if (current === "review") {
      if (catalogLoading || catalogError) {
        stepContent.innerHTML = `<p class="rounded-xl border border-sky-600/30 bg-sky-500/10 p-4 text-sm" role="status" aria-live="polite">${catalogError || "Loading final review…"}</p>`;
      } else renderCharacterBuilderReview(stepContent, {
        document: activeDraft.document,
        entries: catalogEntries,
        disabled: saving,
        finalizing,
        finalizeError,
        entityName: npcMode ? "NPC" : "Character",
        onFinish: finishCharacter,
      });
      focusAfterRender(focusId);
      return;
    }
    if (current !== "home") {
      stepContent.innerHTML = '<div class="rounded-xl border border-stone-300/80 bg-parchment/70 p-4 text-sm text-stone-600 dark:border-white/10 dark:bg-ink/40 dark:text-stone-300">Use Back, Next, or the progress list to move between steps without losing saved work.</div>';
      return;
    }
    renderCharacterBuilderHome(stepContent, {
      document: activeDraft.document,
      entries: catalogEntries,
      loading: catalogLoading,
      error: catalogError,
      disabled: saving,
      pendingRuleset,
      onChange: updateHome,
      onRequestRulesetChange: requestRulesetChange,
      onConfirmRulesetChange: confirmRulesetChange,
      onCancelRulesetChange: cancelRulesetChange,
    });
    focusAfterRender(focusId);
  }

  async function ensureCatalog() {
    if (!catalogPromise) {
      catalogLoading = true;
      catalogPromise = loadCharacterBuilderCatalog().then((catalog) => {
        catalogEntries = catalog.entries;
        catalogVersion = catalog.manifest.catalogVersion || "";
      }).catch((error) => {
        console.error("Could not load Character Builder filters:", error);
        catalogError = "Compendium filters are unavailable. Your other preferences remain saved.";
      }).finally(() => {
        catalogLoading = false;
      });
    }
    await catalogPromise;
    if (!activeDraft) return;
    if (!catalogError && activeDraft.document.build.catalogVersion !== catalogVersion) {
      activeDraft = {
        ...activeDraft,
        document: applyBuilderHomePreferences(activeDraft.document, { catalogVersion }, catalogEntries),
      };
      await persist();
      return;
    }
    renderStepContent();
  }

  async function persist({ focusId = "" } = {}) {
    if (!activeDraft || saving) return;
    saving = true;
    renderProgress();
    renderStepContent();
    renderSaveState();
    try {
      const result = await saveDraft(activeDraft);
      activeDraft = result.draft;
    } catch (error) {
      activeDraft = {
        ...activeDraft,
        sync: { state: "failed", error: error instanceof Error ? error.message : "Cloud synchronization failed." },
      };
    } finally {
      saving = false;
      renderProgress();
      renderStepContent(focusId);
      renderSaveState();
      refreshEntry();
    }
  }

  async function goToStep(stepId) {
    const next = normalizedCharacterBuilderStep(stepId, activeDraft?.currentStep);
    if (!activeDraft || saving || finalizing || next === activeDraft.currentStep) return;
    pendingRuleset = null;
    activeDraft = { ...activeDraft, currentStep: next };
    renderProgress();
    renderStepContent();
    stepTitle.focus();
    await persist();
  }

  async function updateHome(changes, focusId) {
    if (!activeDraft || saving || pendingRuleset) return;
    activeDraft = {
      ...activeDraft,
      document: applyBuilderHomePreferences(activeDraft.document, changes, catalogEntries),
    };
    renderProgress();
    await persist({ focusId });
  }

  async function updateChoiceDocument(nextDocument, focusId) {
    if (!activeDraft || saving) return;
    finalizeError = "";
    activeDraft = { ...activeDraft, document: nextDocument };
    renderProgress();
    await persist({ focusId });
  }

  function updateRootChoice(kind, id, focusId) {
    return updateChoiceDocument(applyBuilderRootSelection(activeDraft.document, catalogEntries, kind, id), focusId);
  }

  function updateClassLevel(level, focusId) {
    return updateChoiceDocument(applyBuilderClassLevel(activeDraft.document, catalogEntries, level), focusId);
  }

  function updateSubclass(id, focusId) {
    return updateChoiceDocument(applyBuilderSubclassSelection(activeDraft.document, catalogEntries, id), focusId);
  }

  function updateRuleChoice(key, selectedIds, focusId) {
    return updateChoiceDocument(applyBuilderRuleSelection(activeDraft.document, catalogEntries, key, selectedIds), focusId);
  }

  function updateSpells(profileId, kind, selectedIds, focusId) {
    return updateChoiceDocument(applyBuilderSpellSelection(activeDraft.document, catalogEntries, profileId, kind, selectedIds), focusId);
  }

  function updateAbilityMethod(method, focusId) {
    return updateChoiceDocument(applyBuilderAbilityMethod(activeDraft.document, method), focusId);
  }

  function updateAbilityScore(abilityId, score, focusId) {
    return updateChoiceDocument(applyBuilderAbilityScore(activeDraft.document, abilityId, score), focusId);
  }

  function rollAbilities(focusId) {
    return updateChoiceDocument(rollBuilderAbilityScores(activeDraft.document), focusId);
  }

  function updateEquipmentMethod(method, focusId) {
    return updateChoiceDocument(applyBuilderEquipmentMethod(activeDraft.document, method), focusId);
  }

  function updateCurrency(coin, amount, focusId) {
    return updateChoiceDocument(applyBuilderCurrency(activeDraft.document, coin, amount), focusId);
  }

  function addInventoryItem(definitionId, quantity, focusId) {
    return updateChoiceDocument(addBuilderInventoryItem(activeDraft.document, catalogEntries, definitionId, quantity), focusId);
  }

  function updateInventoryQuantity(instanceId, quantity, focusId) {
    return updateChoiceDocument(updateBuilderInventoryQuantity(activeDraft.document, instanceId, quantity), focusId);
  }

  function removeInventoryItem(instanceId, focusId) {
    return updateChoiceDocument(removeBuilderInventoryItem(activeDraft.document, instanceId), focusId);
  }

  function updateDescription(changes, focusId) {
    return updateChoiceDocument(applyBuilderDescription(activeDraft.document, changes), focusId);
  }

  async function finishCharacter() {
    if (!activeDraft || saving || finalizing) return;
    const prepared = prepareCharacterBuildFinalization(activeDraft.document, catalogEntries);
    if (!prepared.finalized) {
      renderStepContent("builder-finish-title");
      return;
    }
    finalizing = true;
    finalizeError = "";
    activeDraft = { ...activeDraft, currentStep: "review", document: prepared.document };
    renderProgress();
    renderStepContent();
    await persist();
    try {
      const result = await finalizeDraft(activeDraft.draftId);
      location.href = `${campaignPagePath(npcMode ? "npc" : "char")}${encodeURIComponent(result.id)}/?new=1&edit=1`;
    } catch (error) {
      finalizing = false;
      finalizeError = error instanceof Error ? error.message : `Could not finish this ${entityLabel}.`;
      renderProgress();
      renderStepContent("builder-finalize-error");
      renderSaveState();
    }
  }

  function requestRulesetChange(nextRuleset, returnFocusId) {
    if (!activeDraft || saving || catalogLoading || catalogError) return;
    const preview = previewCharacterRulesetChange(activeDraft.document, nextRuleset, catalogEntries);
    if (!preview.changed) return;
    pendingRuleset = { ...preview, returnFocusId };
    renderStepContent("builder-ruleset-change-title");
  }

  async function confirmRulesetChange() {
    if (!activeDraft || !pendingRuleset || saving) return;
    const preview = pendingRuleset;
    pendingRuleset = null;
    activeDraft = { ...activeDraft, document: preview.document };
    renderProgress();
    await persist({ focusId: preview.to === "5.5e" ? "builder-ruleset-5-5e" : "builder-ruleset-5e" });
  }

  function cancelRulesetChange() {
    if (!pendingRuleset) return;
    const returnFocusId = pendingRuleset.returnFocusId;
    pendingRuleset = null;
    renderStepContent(returnFocusId);
  }

  async function openDetailedBuilder() {
    const recovered = latestCharacterBuildDraft(readDrafts());
    activeDraft = recovered || createCharacterBuildDraft({ draftId: createDraftId() });
    activeDraft = { ...activeDraft, currentStep: recovered ? resumeCharacterBuilderStep(activeDraft, {
      evaluation: currentEvaluation(),
      catalog: catalogEntries,
      ...currentValidations(),
    }) : "home" };
    quickSetup.hidden = true;
    shell.hidden = false;
    kicker.textContent = "Detailed build";
    title.textContent = recovered ? `Continue your ${entityLabel}` : `Build ${entityWithArticle}`;
    description.textContent = "Move between steps freely. Valid changes save in this browser before cloud sync.";
    if (!cloudDrafts) description.textContent = "Move between steps freely. Valid changes save in this browser.";
    renderProgress();
    renderStepContent();
    renderSaveState({ recovered: Boolean(recovered) });
    stepTitle.focus();
    if (!recovered || activeDraft.currentStep !== recovered.currentStep) await persist();
    await ensureCatalog();
  }

  function showQuickSetup() {
    pendingRuleset = null;
    finalizing = false;
    finalizeError = "";
    shell.hidden = true;
    quickSetup.hidden = false;
    kicker.textContent = "Quick setup";
    title.textContent = `Create ${entityWithArticle}`;
    description.textContent = "Start with the essentials. You can change everything in the full editor.";
    refreshEntry();
    entryButton.focus();
  }

  function reset() {
    activeDraft = null;
    pendingRuleset = null;
    finalizing = false;
    finalizeError = "";
    shell.hidden = true;
    quickSetup.hidden = false;
    kicker.textContent = "Quick setup";
    title.textContent = `Create ${entityWithArticle}`;
    description.textContent = "Start with the essentials. You can change everything in the full editor.";
    refreshEntry();
  }

  entryButton.addEventListener("click", openDetailedBuilder);
  quickSetupButton.addEventListener("click", showQuickSetup);
  retryButton.addEventListener("click", persist);
  backButton.addEventListener("click", () => goToStep(adjacentCharacterBuilderStep(activeDraft?.currentStep, -1)));
  nextButton.addEventListener("click", () => goToStep(adjacentCharacterBuilderStep(activeDraft?.currentStep, 1)));
  refreshEntry();

  return { reset, openDetailedBuilder, showQuickSetup };
}
