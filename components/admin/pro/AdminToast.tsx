"use client";

import { useEffect } from "react";

type Props = {
  message: string;
  tone: "success" | "error" | "info";
  onClose: () => void;
};

export default function AdminToast({
  message,
  tone,
  onClose,
}: Props) {
  useEffect(() => {
    if (!message) return;

    const timer = window.setTimeout(onClose, 3600);

    return () => {
      window.clearTimeout(timer);
    };
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className={`admin-pro-toast tone-${tone}`} role="status">
      <span>
        {tone === "success" ? "✓" : tone === "error" ? "!" : "i"}
      </span>

      <p>{message}</p>

      <button type="button" onClick={onClose} aria-label="Tutup">
        ×
      </button>
    </div>
  );
}
