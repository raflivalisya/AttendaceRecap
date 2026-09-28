"use client";

export type SaveState = "saved" | "unsaved" | "saving" | "error";

const labels: Record<SaveState, string> = {
  saved: "Tersimpan",
  unsaved: "Belum tersimpan",
  saving: "Menyimpan…",
  error: "Gagal autosave",
};

export default function SaveStateBadge({ state }: { state: SaveState }) {
  return (
    <span className={`save-state save-state-${state}`} role="status" aria-live="polite">
      <span className="save-state-dot" aria-hidden="true" />
      {labels[state]}
    </span>
  );
}
