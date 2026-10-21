// Reusable semantic classes. Feature-specific positioning stays beside its markup.
export const GC_CLASSES = Object.freeze({
  button: "gc-button bg-blood-500 text-on-accent",
  secondaryButton: "gc-button border border-theme-border text-theme-text",
  field: "gc-field",
  panel: "gc-panel p-4",
});

export const GC_CARD_CLASSES = Object.freeze({
  card: "gc-panel min-w-0 h-full overflow-hidden",
  cardHeader: "tracker-card-header flex flex-wrap items-start justify-between gap-3 border-b border-theme-border px-5 py-4 font-semibold",
  cardBody: "p-5",
  badge: "gc-badge tracker-badge max-w-full border border-transparent text-center",
  badgeDanger: "tracker-badge-danger bg-danger-500 text-white",
  badgeSecondary: "tracker-badge-neutral bg-theme-surface-strong text-theme-text",
  badgeWarning: "tracker-badge-warning bg-amber-300 text-stone-900",
  badgeSuccess: "tracker-badge-success bg-emerald-600 text-white",
  badgePrimary: "tracker-badge-primary bg-sky-700 text-white",
  iconButton: "gc-button h-9 w-9 border border-theme-border bg-theme-surface-strong text-theme-text",
});
