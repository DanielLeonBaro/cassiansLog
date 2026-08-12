export const trackerUI = {
  card: "min-w-0 h-full overflow-hidden rounded-2xl border border-stone-300/80 bg-white/75 shadow-card dark:border-white/10 dark:bg-white/[.055]",
  cardHeader: "flex flex-wrap items-center justify-between gap-3 border-b border-stone-200/80 bg-stone-100/70 px-5 py-4 font-bold leading-none dark:border-white/10 dark:bg-white/[.045]",
  cardBody: "p-5",
  badge: "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold",
  badgeDanger: "bg-blood-500 text-white",
  badgeSecondary: "bg-stone-200 text-stone-700 dark:bg-white/10 dark:text-stone-200",
  badgeWarning: "bg-amber-300 text-stone-900",
  badgeSuccess: "bg-emerald-600 text-white",
  badgePrimary: "bg-sky-700 text-white",
  iconButton: "inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-300 bg-stone-100 text-sm font-bold text-stone-700 shadow-sm transition hover:border-blood-500 hover:bg-blood-500 hover:text-white dark:border-white/15 dark:bg-white/10 dark:text-stone-100 dark:hover:bg-blood-500",
};

export function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value ?? "—";
}

export function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function escapeAttribute(value) {
  return String(value ?? "").replace(/[^a-zA-Z0-9_-]/g, "-");
}
