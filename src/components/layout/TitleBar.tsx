export function TitleBar() {
  return (
    <div
      data-tauri-drag-region
      className="flex items-center h-9 bg-[var(--color-surface)] border-b border-[var(--color-border)] select-none px-3"
    >
      <span data-tauri-drag-region className="text-sm font-semibold text-[var(--color-text-muted)]">
        MaxAuto
      </span>
    </div>
  );
}
