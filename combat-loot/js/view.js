import { escapeAttribute, escapeHTML } from "../../shared/js/text.js";
import { calculateCurrentHP } from "./model.js";

const iconButton = "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-stone-300 bg-white/70 text-xs text-stone-600 transition hover:border-blood-500 hover:text-blood-500 disabled:cursor-not-allowed disabled:opacity-35 dark:border-white/15 dark:bg-white/5 dark:text-stone-300";
const toolbarButton = "inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white/70 px-3 py-2 text-xs font-bold text-stone-700 transition hover:border-blood-500 hover:text-blood-500 dark:border-white/15 dark:bg-white/5 dark:text-stone-200";

function actionButton({ action, icon, label, title = label, data = "", disabled = false, danger = false }) {
  return `<button type="button" data-action="${action}" ${data} ${disabled ? "disabled" : ""} class="${iconButton} ${danger ? "hover:border-red-500 hover:text-red-500" : ""}" aria-label="${escapeAttribute(label)}" title="${escapeAttribute(title)}"><i class="bi ${icon}" aria-hidden="true"></i></button>`;
}

function tableToolbar(table) {
  const tableData = `data-table-id="${escapeAttribute(table.id)}"`;
  const common = `<button type="button" data-action="add-row-end" ${tableData} class="${toolbarButton}"><i class="bi bi-plus-lg"></i>Add row</button>`;
  if (table.type === "initiative") {
    return `${common}<button type="button" data-action="sort-initiative" ${tableData} class="${toolbarButton}"><i class="bi bi-sort-numeric-down-alt"></i>Sort initiative</button><button type="button" data-action="send-to-combat" ${tableData} class="${toolbarButton} border-blood-500 bg-blood-500 text-white hover:bg-blood-600 hover:text-white"><i class="bi bi-arrow-down-square-fill"></i>Send to Combat</button>`;
  }
  if (table.type === "combat") {
    return `${common}<button type="button" data-action="add-column-end" ${tableData} class="${toolbarButton}"><i class="bi bi-layout-three-columns"></i>Add column</button><button type="button" data-action="add-round" ${tableData} class="${toolbarButton} border-blood-500 text-blood-500"><i class="bi bi-plus-square-fill"></i>Add round</button>`;
  }
  return `${common}<button type="button" data-action="add-column-end" ${tableData} class="${toolbarButton}"><i class="bi bi-layout-three-columns"></i>Add column</button><button type="button" data-action="delete-table" ${tableData} class="${toolbarButton} border-red-400 text-red-600 hover:border-red-500 hover:text-red-700 dark:text-red-300"><i class="bi bi-trash-fill"></i>Delete tracker</button>`;
}

function tableTitle(table) {
  if (table.type !== "custom")
    return `<h2 class="font-display text-2xl font-bold">${escapeHTML(table.title)}</h2>`;
  return `<label class="block min-w-0"><span class="sr-only">Tracker title</span><input type="text" maxlength="100" data-tracker-title data-table-id="${escapeAttribute(table.id)}" value="${escapeAttribute(table.title)}" class="w-full max-w-md rounded-lg border border-transparent bg-transparent px-2 py-1 font-display text-2xl font-bold outline-none transition hover:border-stone-300 focus:border-blood-500 dark:hover:border-white/15"></label>`;
}

function columnHeader(table, column, columnIndex) {
  if (table.type === "initiative")
    return `<th scope="col" class="min-w-40 border-l border-stone-200 px-3 py-3 text-left text-sm dark:border-white/10">${escapeHTML(column.title)}</th>`;
  const data = `data-table-id="${escapeAttribute(table.id)}" data-column-id="${escapeAttribute(column.id)}"`;
  return `<th scope="col" class="min-w-52 border-l border-stone-200 p-2 align-top dark:border-white/10">
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

function combatHealth(table, row) {
  const hpColumn = table.columns.find((column) => column.role === "hp");
  const damageColumn = table.columns.find((column) => column.role === "damage");
  return calculateCurrentHP(
    hpColumn ? row.cells?.[hpColumn.id] : "",
    damageColumn ? row.cells?.[damageColumn.id] : "",
  );
}

function inlineCell(table, row, column, health) {
  const numeric = ["initiative", "damage", "hp"].includes(column.role);
  const invalidHealthInput = table.type === "combat"
    && ((column.role === "hp" && !health.hpValid)
      || (column.role === "damage" && !health.damageValid));
  const invalidAttributes = invalidHealthInput
    ? 'aria-invalid="true" title="Enter a number"'
    : "";
  const borderClasses = invalidHealthInput
    ? "border-red-500/80 hover:border-red-500 focus:border-red-500 dark:border-red-400/80"
    : "border-transparent hover:border-stone-300 focus:border-blood-500 dark:hover:border-white/15";
  return `<label class="block"><span class="sr-only">${escapeHTML(column.title)}</span><input type="text" ${numeric ? `inputmode="${column.role === "initiative" ? "numeric" : "decimal"}"` : ""} ${invalidAttributes} data-inline-cell data-table-id="${escapeAttribute(table.id)}" data-row-id="${escapeAttribute(row.id)}" data-column-id="${escapeAttribute(column.id)}" value="${escapeAttribute(row.cells?.[column.id] || "")}" class="w-full min-w-28 rounded-lg border bg-transparent px-2 py-2 text-sm outline-none transition ${borderClasses}"></label>`;
}

function modalCell(table, row, column) {
  const value = String(row.cells?.[column.id] || "");
  return `<button type="button" data-action="open-cell-editor" data-table-id="${escapeAttribute(table.id)}" data-row-id="${escapeAttribute(row.id)}" data-column-id="${escapeAttribute(column.id)}" class="block min-h-12 w-full min-w-52 rounded-lg border border-transparent px-2 py-2 text-left text-sm transition hover:border-blood-500 hover:bg-blood-500/5"><span class="line-clamp-3 whitespace-pre-wrap ${value ? "" : "italic text-stone-400"}">${escapeHTML(value || "Add text…")}</span></button>`;
}

function currentHPCell(table, row, health) {
  const content = health.valid
    ? `<output class="font-semibold tabular-nums" aria-label="Current HP: ${escapeAttribute(health.value)}">${escapeHTML(health.value)}</output>`
    : `<span class="inline-flex items-center gap-2 font-semibold text-red-600 dark:text-red-400" role="img" aria-label="Current HP unavailable. Enter numbers for HP and Damage."><i class="bi bi-x-circle-fill text-lg" aria-hidden="true"></i><span class="sr-only">Enter numbers for HP and Damage</span></span>`;
  return `<div data-current-hp data-table-id="${escapeAttribute(table.id)}" data-row-id="${escapeAttribute(row.id)}" data-valid="${health.valid}" aria-live="polite">${content}</div>`;
}

function cell(table, row, column) {
  const health = table.type === "combat" ? combatHealth(table, row) : null;
  const inline = table.type === "initiative" || (table.type === "combat" && ["character", "damage", "hp", "ac", "condition"].includes(column.role));
  let content;
  if (table.type === "combat" && column.role === "currentHp") {
    content = currentHPCell(table, row, health);
  } else {
    content = inline ? inlineCell(table, row, column, health) : modalCell(table, row, column);
  }
  return `<td class="border-l border-t border-stone-200 p-1.5 align-top dark:border-white/10">${content}</td>`;
}

function rowControls(table, row, index) {
  const data = `data-table-id="${escapeAttribute(table.id)}" data-row-id="${escapeAttribute(row.id)}"`;
  return `<td class="border-t border-stone-200 p-2 align-middle dark:border-white/10"><div class="flex min-w-32 items-center gap-1">
    <button type="button" draggable="true" data-row-drag ${data} class="${iconButton} cursor-grab active:cursor-grabbing" aria-label="Drag row ${index + 1}" title="Drag row"><i class="bi bi-grip-vertical"></i></button>
    ${actionButton({ action: "insert-row-before", icon: "bi-plus-lg", label: `Insert row before ${index + 1}`, data })}
    ${actionButton({ action: "insert-row-after", icon: "bi-plus-square", label: `Insert row after ${index + 1}`, data })}
    ${actionButton({ action: "move-row", icon: "bi-arrow-up", label: `Move row ${index + 1} up`, data: `${data} data-delta="-1"`, disabled: index === 0 })}
    ${actionButton({ action: "move-row", icon: "bi-arrow-down", label: `Move row ${index + 1} down`, data: `${data} data-delta="1"`, disabled: index === table.rows.length - 1 })}
    ${actionButton({ action: "delete-row", icon: "bi-trash", label: `Delete row ${index + 1}`, data, danger: true })}
  </div></td>`;
}

function renderRows(table) {
  if (!table.rows.length)
    return `<tr><td colspan="${table.columns.length + 2}" class="border-t border-stone-200 px-4 py-8 text-center text-sm text-stone-500 dark:border-white/10">No rows yet. Use Add row to continue.</td></tr>`;
  return table.rows.map((row, index) => `<tr data-table-row data-table-id="${escapeAttribute(table.id)}" data-row-id="${escapeAttribute(row.id)}" class="bg-white/35 transition dark:bg-white/[.015]">
    ${rowControls(table, row, index)}
    <th scope="row" class="w-12 border-t border-stone-200 px-3 py-2 text-center text-sm font-bold text-stone-400 dark:border-white/10">${index + 1}</th>
    ${table.columns.map((column) => cell(table, row, column)).join("")}
  </tr>`).join("");
}

export function renderTracker(table) {
  return `<article data-tracker data-table-id="${escapeAttribute(table.id)}" class="overflow-hidden rounded-2xl border border-stone-300/80 bg-white/75 shadow-card backdrop-blur-sm dark:border-white/10 dark:bg-white/[.055]">
    <header class="flex flex-col gap-3 border-b border-stone-200/80 bg-stone-100/70 px-4 py-4 dark:border-white/10 dark:bg-white/[.045] lg:flex-row lg:items-center lg:justify-between">
      ${tableTitle(table)}
      <div class="flex flex-wrap gap-2">${tableToolbar(table)}</div>
    </header>
    <div class="overflow-x-auto">
      <table class="w-full border-collapse">
        <thead><tr class="bg-stone-100/50 dark:bg-white/[.025]"><th scope="col" class="min-w-36 px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-stone-400">Row tools</th><th scope="col" class="w-12 px-3 py-3 text-center text-xs font-bold uppercase tracking-wide text-stone-400">#</th>${table.columns.map((column, index) => columnHeader(table, column, index)).join("")}</tr></thead>
        <tbody>${renderRows(table)}</tbody>
      </table>
    </div>
  </article>`;
}

export function renderWorkspace(document) {
  return document.tables.map(renderTracker).join("");
}
