import { escapeAttribute, escapeHTML } from "../../shared/js/text.js";
import { calculateCurrentHP, evaluateArithmeticFormula } from "./model.js";

const iconButton = "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-stone-300 bg-white/70 text-xs text-stone-600 transition hover:border-blood-500 hover:text-blood-500 disabled:cursor-not-allowed disabled:opacity-35 dark:border-white/15 dark:bg-white/5 dark:text-stone-300";
const toolbarButtonBase = "inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition";
const toolbarButton = `${toolbarButtonBase} border-stone-300 bg-white/70 text-stone-700 hover:border-blood-500 hover:text-blood-500 dark:border-white/15 dark:bg-white/5 dark:text-stone-200`;
const greenToolbarButton = `${toolbarButtonBase} border-emerald-700 bg-emerald-700 text-white hover:border-emerald-800 hover:bg-emerald-800`;
const yellowToolbarButton = `${toolbarButtonBase} border-yellow-200 bg-yellow-200 text-yellow-950 hover:border-yellow-300`;
const violetToolbarButton = `${toolbarButtonBase} border-violet-300 bg-violet-300 text-violet-950 hover:border-violet-400`;
const ROW_TOOLS_WIDTH = "15rem";

function actionButton({ action, icon, label, title = label, data = "", disabled = false, danger = false }) {
  return `<button type="button" data-action="${action}" ${data} ${disabled ? "disabled" : ""} class="${iconButton} ${danger ? "hover:border-red-500 hover:text-red-500" : ""}" aria-label="${escapeAttribute(label)}" title="${escapeAttribute(title)}"><i class="bi ${icon}" aria-hidden="true"></i></button>`;
}

function toggleButton(action, label, icon, pressed, tableData) {
  const classes = pressed
    ? `${toolbarButtonBase} border-blood-500 bg-blood-500 text-white hover:bg-blood-600`
    : `${toolbarButtonBase} border-stone-400 bg-white/70 text-stone-700 hover:border-blood-500 hover:text-blood-500 dark:border-white/20 dark:bg-white/5 dark:text-stone-200`;
  return `<button type="button" data-action="${action}" ${tableData} aria-pressed="${pressed}" class="${classes}"><i class="bi ${icon}"></i>${escapeHTML(label)}</button>`;
}

function tableToolbar(table, view) {
  const tableData = `data-table-id="${escapeAttribute(table.id)}"`;
  const common = `<button type="button" data-action="add-row-end" ${tableData} class="${greenToolbarButton}"><i class="bi bi-plus-lg"></i>Add row</button>`;
  const rowTools = toggleButton(
    "toggle-row-tools",
    view.hideRowTools ? "Show row tools" : "Hide row tools",
    view.hideRowTools ? "bi-tools" : "bi-eye-slash",
    Boolean(view.hideRowTools),
    tableData,
  );
  if (table.type === "initiative") {
    return `${common}<button type="button" data-action="set-party" ${tableData} class="${yellowToolbarButton}"><i class="bi bi-people-fill"></i>Set a Party</button><button type="button" data-action="bring-party" ${tableData} class="${yellowToolbarButton}"><i class="bi bi-person-plus-fill"></i>Bring a Party</button><span class="inline-flex gap-1"><button type="button" data-action="sort-initiative" ${tableData} class="${violetToolbarButton}"><i class="bi bi-sort-numeric-down-alt"></i>Sort Initiative</button><button type="button" data-action="send-to-combat" ${tableData} class="${violetToolbarButton}"><i class="bi bi-arrow-down-square-fill"></i>Send to Combat</button></span>${rowTools}`;
  }
  if (table.type === "combat") {
    return `${common}<button type="button" data-action="add-column-end" ${tableData} class="${greenToolbarButton}"><i class="bi bi-layout-three-columns"></i>Add column</button><button type="button" data-action="add-round" ${tableData} class="${toolbarButton} border-blood-500 text-blood-500"><i class="bi bi-plus-square-fill"></i>Add round</button>${rowTools}${toggleButton("toggle-character-info", view.hideCharacterInfo ? "Show Character Info" : "Hide Character Info", view.hideCharacterInfo ? "bi-person-vcard-fill" : "bi-eye-slash", Boolean(view.hideCharacterInfo), tableData)}${toggleButton("toggle-rounds", view.hideRounds ? "Show Rounds" : "Hide Rounds", view.hideRounds ? "bi-calendar3" : "bi-eye-slash", Boolean(view.hideRounds), tableData)}`;
  }
  return `${common}<button type="button" data-action="add-column-end" ${tableData} class="${greenToolbarButton}"><i class="bi bi-layout-three-columns"></i>Add column</button>${rowTools}<button type="button" data-action="delete-table" ${tableData} class="${toolbarButton} border-red-400 text-red-600 hover:border-red-500 hover:text-red-700 dark:text-red-300"><i class="bi bi-trash-fill"></i>Delete tracker</button>`;
}

function tableTitle(table) {
  if (table.type !== "custom")
    return `<h2 class="font-display text-2xl font-bold">${escapeHTML(table.title)}</h2>`;
  return `<label class="block min-w-0"><span class="sr-only">Tracker title</span><input type="text" maxlength="100" data-tracker-title data-table-id="${escapeAttribute(table.id)}" value="${escapeAttribute(table.title)}" class="w-full max-w-md rounded-lg border border-transparent bg-transparent px-2 py-1 font-display text-2xl font-bold outline-none transition hover:border-stone-300 focus:border-blood-500 dark:hover:border-white/15"></label>`;
}

function columnIsHidden(table, column, view) {
  if (table.type !== "combat") return false;
  if (view.hideRounds && column.role === "round") return true;
  return Boolean(view.hideCharacterInfo)
    && ["damage", "hp", "currentHp", "ac", "condition"].includes(column.role);
}

function stickyLeft(view, kind) {
  if (kind === "number") return view.hideRowTools ? "0" : ROW_TOOLS_WIDTH;
  return view.hideRowTools ? "3rem" : "18rem";
}

function columnHeader(table, column, columnIndex, view) {
  const sticky = column.role === "character"
    ? `sticky z-20 bg-stone-100 dark:bg-stone-900` : "";
  const style = column.role === "character" ? `style="left:${stickyLeft(view, "character")}"` : "";
  if (table.type === "initiative")
    return `<th scope="col" ${style} class="${sticky} min-w-40 border-l border-stone-200 px-3 py-3 text-left text-sm dark:border-white/10">${escapeHTML(column.title)}</th>`;
  const data = `data-table-id="${escapeAttribute(table.id)}" data-column-id="${escapeAttribute(column.id)}"`;
  return `<th scope="col" ${style} class="${sticky} min-w-52 border-l border-stone-200 p-2 align-top dark:border-white/10">
    <label class="block"><span class="sr-only">Column name</span><input type="text" maxlength="100" data-column-title ${data} value="${escapeAttribute(column.title)}" class="w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm font-bold outline-none transition hover:border-stone-300 focus:border-blood-500 dark:hover:border-white/15"></label>
    <div class="mt-1 flex flex-wrap justify-end gap-1">
      ${actionButton({ action: "insert-column-before", icon: "bi-plus-lg", label: `Insert column before ${column.title}`, data })}
      ${actionButton({ action: "insert-column-after", icon: "bi-plus-square", label: `Insert column after ${column.title}`, data })}
      ${actionButton({ action: "move-column", icon: "bi-arrow-left", label: `Move ${column.title} left`, data: `${data} data-delta="-1"`, disabled: columnIndex === 0 })}
      ${actionButton({ action: "move-column", icon: "bi-arrow-right", label: `Move ${column.title} right`, data: `${data} data-delta="1"`, disabled: columnIndex === table.columns.length - 1 })}
      ${actionButton({ action: "delete-column", icon: "bi-trash", label: `Delete ${column.title}`, data, danger: true })}
    </div>
  </th>`;
}

function placeholderValue(value) {
  const text = String(value ?? "").trim();
  return !text || text === "0";
}

function rowCharacter(table, row) {
  const column = table.columns.find((candidate) => candidate.role === "character");
  return column ? String(row.cells?.[column.id] || "").trim() : "";
}

function combatHealth(table, row) {
  const hpColumn = table.columns.find((column) => column.role === "hp");
  const damageColumn = table.columns.find((column) => column.role === "damage");
  const hp = hpColumn ? row.cells?.[hpColumn.id] : "";
  const damage = damageColumn ? row.cells?.[damageColumn.id] : "";
  const base = calculateCurrentHP(hp, damage);
  const hasCharacter = Boolean(rowCharacter(table, row));
  const hpPlaceholder = placeholderValue(hp);
  const damagePlaceholder = placeholderValue(damage);
  return {
    ...base,
    hasCharacter,
    hpPlaceholder,
    damagePlaceholder,
    hpValid: hpPlaceholder ? !hasCharacter : base.hpValid,
    damageValid: damagePlaceholder ? true : base.damageValid,
    valid: base.valid && !(hasCharacter && hpPlaceholder),
  };
}

function inlineCell(table, row, column, health) {
  const rawValue = String(row.cells?.[column.id] ?? "");
  const isPlaceholder = table.type === "combat"
    && ["hp", "ac"].includes(column.role)
    && placeholderValue(rawValue);
  const hasCharacter = table.type === "combat" && Boolean(rowCharacter(table, row));
  const numberResult = calculateCurrentHP(rawValue, "0");
  const invalidHealthInput = table.type === "combat" && (
    (column.role === "hp" && !health.hpValid)
    || (column.role === "ac" && ((!isPlaceholder && !numberResult.hpValid) || (hasCharacter && isPlaceholder)))
  );
  const invalidAttributes = invalidHealthInput
    ? 'aria-invalid="true" title="Enter a number"'
    : "";
  const borderClasses = invalidHealthInput
    ? "border-red-500/80 hover:border-red-500 focus:border-red-500 dark:border-red-400/80"
    : "border-transparent hover:border-stone-300 focus:border-blood-500 dark:hover:border-white/15";
  const numeric = ["initiative", "hp", "ac"].includes(column.role);
  const surfaceSize = table.type === "combat" && ["hp", "ac"].includes(column.role)
    ? "min-h-12 min-w-52" : "min-w-28";
  return `<label class="block"><span class="sr-only">${escapeHTML(column.title)}</span><input type="text" ${numeric ? `inputmode="${column.role === "initiative" ? "numeric" : "decimal"}"` : ""} ${invalidAttributes} data-inline-cell data-table-id="${escapeAttribute(table.id)}" data-row-id="${escapeAttribute(row.id)}" data-column-id="${escapeAttribute(column.id)}" value="${escapeAttribute(isPlaceholder ? "" : rawValue)}" ${isPlaceholder ? 'placeholder="0"' : ""} class="w-full ${surfaceSize} rounded-lg border bg-transparent px-2 py-2 text-left text-sm outline-none transition placeholder:italic placeholder:text-stone-400 ${borderClasses}"></label>`;
}

function modalCell(table, row, column) {
  const value = String(row.cells?.[column.id] || "");
  return `<button type="button" data-action="open-cell-editor" data-table-id="${escapeAttribute(table.id)}" data-row-id="${escapeAttribute(row.id)}" data-column-id="${escapeAttribute(column.id)}" class="block min-h-12 w-full min-w-52 rounded-lg border border-transparent px-2 py-2 text-left text-sm transition hover:border-blood-500 hover:bg-blood-500/5"><span class="line-clamp-3 whitespace-pre-wrap ${value ? "" : "italic text-stone-400"}">${escapeHTML(value || "Add text…")}</span></button>`;
}

function damageCell(table, row, column, health) {
  const formula = String(row.cells?.[column.id] ?? "").trim();
  const placeholder = placeholderValue(formula);
  const result = evaluateArithmeticFormula(formula);
  const invalid = !placeholder && !result.valid;
  let content = `<span class="italic text-stone-400">0</span>`;
  if (!placeholder && result.valid) {
    content = `<span class="block font-semibold tabular-nums">${escapeHTML(result.value)}</span><span class="block truncate text-xs text-stone-400">${escapeHTML(formula)}</span>`;
  } else if (!placeholder) {
    content = `<span class="block truncate text-red-600 dark:text-red-400">${escapeHTML(formula)}</span>`;
  }
  return `<button type="button" data-damage-cell data-action="open-cell-editor" data-table-id="${escapeAttribute(table.id)}" data-row-id="${escapeAttribute(row.id)}" data-column-id="${escapeAttribute(column.id)}" ${invalid ? 'aria-invalid="true" title="Enter a formula using numbers, +, -, and parentheses"' : ""} class="block min-h-12 w-full min-w-52 rounded-lg border px-2 py-2 text-left text-sm transition hover:border-blood-500 hover:bg-blood-500/5 ${invalid ? "border-red-500/80 dark:border-red-400/80" : "border-transparent"}">${content}</button>`;
}

function currentHPCell(table, row, health) {
  let content;
  if (!health.hasCharacter && health.hpPlaceholder && health.damagePlaceholder) {
    content = `<span class="italic text-stone-400" aria-label="Current HP placeholder">0</span>`;
  } else if (health.valid) {
    content = `<output class="font-semibold tabular-nums" aria-label="Current HP: ${escapeAttribute(health.value)}">${escapeHTML(health.value)}</output>`;
  } else {
    content = `<span class="inline-flex items-center gap-2 font-semibold text-red-600 dark:text-red-400" role="img" aria-label="Current HP unavailable. Enter HP and a valid Damage formula."><i class="bi bi-x-circle-fill text-lg" aria-hidden="true"></i><span class="sr-only">Enter HP and a valid Damage formula</span></span>`;
  }
  return `<div data-current-hp data-table-id="${escapeAttribute(table.id)}" data-row-id="${escapeAttribute(row.id)}" data-valid="${health.valid}" aria-live="polite" class="flex min-h-12 w-full min-w-52 items-center rounded-lg border border-transparent px-2 py-2 text-left text-sm">${content}</div>`;
}

function cell(table, row, column, view) {
  const health = table.type === "combat" ? combatHealth(table, row) : null;
  let content;
  if (table.type === "combat" && column.role === "currentHp") {
    content = currentHPCell(table, row, health);
  } else if (table.type === "combat" && column.role === "damage") {
    content = damageCell(table, row, column, health);
  } else {
    const inline = table.type === "initiative"
      || (table.type === "combat" && ["character", "hp", "ac"].includes(column.role));
    content = inline ? inlineCell(table, row, column, health) : modalCell(table, row, column);
  }
  const sticky = column.role === "character"
    ? "sticky z-10 bg-stone-50 dark:bg-stone-900" : "";
  const style = column.role === "character" ? `style="left:${stickyLeft(view, "character")}"` : "";
  return `<td ${style} class="${sticky} border-l border-t border-stone-200 p-1.5 align-top dark:border-white/10">${content}</td>`;
}

function rowControls(table, row, index) {
  const data = `data-table-id="${escapeAttribute(table.id)}" data-row-id="${escapeAttribute(row.id)}"`;
  return `<td style="left:0;width:${ROW_TOOLS_WIDTH};min-width:${ROW_TOOLS_WIDTH}" class="sticky z-20 border-t border-stone-200 bg-stone-50 p-2 align-middle dark:border-white/10 dark:bg-stone-900"><div class="flex items-center gap-1">
    <button type="button" draggable="true" data-row-drag ${data} class="${iconButton} cursor-grab active:cursor-grabbing" aria-label="Drag row ${index + 1}" title="Drag row"><i class="bi bi-grip-vertical"></i></button>
    ${actionButton({ action: "insert-row-before", icon: "bi-plus-lg", label: `Insert row before ${index + 1}`, data })}
    ${actionButton({ action: "insert-row-after", icon: "bi-plus-square", label: `Insert row after ${index + 1}`, data })}
    ${actionButton({ action: "move-row", icon: "bi-arrow-up", label: `Move row ${index + 1} up`, data: `${data} data-delta="-1"`, disabled: index === 0 })}
    ${actionButton({ action: "move-row", icon: "bi-arrow-down", label: `Move row ${index + 1} down`, data: `${data} data-delta="1"`, disabled: index === table.rows.length - 1 })}
    ${actionButton({ action: "delete-row", icon: "bi-trash", label: `Delete row ${index + 1}`, data, danger: true })}
  </div></td>`;
}

function visibleColumns(table, view) {
  return table.columns.filter((column) => !columnIsHidden(table, column, view));
}

function renderRows(table, view) {
  const columns = visibleColumns(table, view);
  if (!table.rows.length)
    return `<tr><td colspan="${columns.length + (view.hideRowTools ? 1 : 2)}" class="border-t border-stone-200 px-4 py-8 text-center text-sm text-stone-500 dark:border-white/10">No rows yet. Use Add row to continue.</td></tr>`;
  return table.rows.map((row, index) => `<tr data-table-row data-table-id="${escapeAttribute(table.id)}" data-row-id="${escapeAttribute(row.id)}" class="bg-white/35 transition dark:bg-white/[.015]">
    ${view.hideRowTools ? "" : rowControls(table, row, index)}
    <th scope="row" style="left:${stickyLeft(view, "number")}" class="sticky z-20 w-12 min-w-12 border-t border-stone-200 bg-stone-50 px-3 py-2 text-center text-sm font-bold text-stone-400 dark:border-white/10 dark:bg-stone-900">${index + 1}</th>
    ${columns.map((column) => cell(table, row, column, view)).join("")}
  </tr>`).join("");
}

export function renderTracker(table, view = {}) {
  const columns = visibleColumns(table, view);
  return `<article data-tracker data-table-id="${escapeAttribute(table.id)}" class="overflow-hidden rounded-2xl border border-stone-300/80 bg-white/75 shadow-card backdrop-blur-sm dark:border-white/10 dark:bg-white/[.055]">
    <header class="flex flex-col gap-3 border-b border-stone-200/80 bg-stone-100/70 px-4 py-4 dark:border-white/10 dark:bg-white/[.045] lg:flex-row lg:items-center lg:justify-between">
      ${tableTitle(table)}
      <div class="flex flex-wrap gap-2">${tableToolbar(table, view)}</div>
    </header>
    <div class="overflow-x-auto">
      <table class="w-full border-collapse">
        <thead><tr class="bg-stone-100/50 dark:bg-white/[.025]">${view.hideRowTools ? "" : `<th scope="col" style="left:0;width:${ROW_TOOLS_WIDTH};min-width:${ROW_TOOLS_WIDTH}" class="sticky z-30 bg-stone-100 px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-stone-400 dark:bg-stone-900">Row tools</th>`}<th scope="col" style="left:${stickyLeft(view, "number")}" class="sticky z-30 w-12 min-w-12 bg-stone-100 px-3 py-3 text-center text-xs font-bold uppercase tracking-wide text-stone-400 dark:bg-stone-900">#</th>${columns.map((column) => columnHeader(table, column, table.columns.indexOf(column), view)).join("")}</tr></thead>
        <tbody>${renderRows(table, view)}</tbody>
      </table>
    </div>
  </article>`;
}

export function renderWorkspace(document, tableViews = {}) {
  return document.tables.map((table) => renderTracker(table, tableViews[table.id] || {})).join("");
}
