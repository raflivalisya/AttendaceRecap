"use client";

import { useEffect, useState } from "react";
import type { AssistantDirectoryItem } from "@/lib/asdos/types";

type Props = {
  courseId: string;
};

export default function CourseAssistantManager({ courseId }: Props) {
  const [assistants, setAssistants] = useState<AssistantDirectoryItem[]>([]);
  const [assigned, setAssigned] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    if (!courseId) return;
    setLoading(true);
    setMessage("");
    const response = await fetch(`/api/admin/asdos/accounts?courseId=${encodeURIComponent(courseId)}`, { cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(result.error ?? "Gagal memuat daftar Asdos.");
      setLoading(false);
      return;
    }
    setAssistants(result.assistants ?? []);
    setAssigned(new Set(result.assigned_user_ids ?? []));
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [courseId]);

  async function toggle(userId: string, shouldAssign: boolean) {
    setSavingId(userId);
    setMessage("");
    const response = await fetch("/api/admin/asdos/assignments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ course_id: courseId, assistant_user_id: userId, assigned: shouldAssign }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(result.error ?? "Gagal mengubah penugasan Asdos.");
      setSavingId("");
      return;
    }

    setAssigned((current) => {
      const next = new Set(current);
      if (shouldAssign) next.add(userId);
      else next.delete(userId);
      return next;
    });
    setMessage(shouldAssign ? "Asisten berhasil ditugaskan ke mata kuliah." : "Penugasan Asisten dihapus.");
    setSavingId("");
  }

  return (
    <div style={{ gridColumn: "1 / -1", marginTop: 12 }}>
      <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h3 style={{ margin: 0 }}>Asisten Dosen</h3>
            <p className="muted" style={{ margin: "5px 0 0" }}>Pilih akun Asdos yang boleh mengelola presensi pada mata kuliah ini.</p>
          </div>
          <span className="badge neutral">{assigned.size} Asdos ditugaskan</span>
        </div>

        {message && <div className={message.toLowerCase().includes("gagal") ? "error" : "success"} style={{ marginTop: 12 }}>{message}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10, marginTop: 14 }}>
          {assistants.map((assistant) => {
            const checked = assigned.has(assistant.user_id);
            return (
              <label key={assistant.user_id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: 12, border: checked ? "1px solid #2563eb" : "1px solid #dbe3ec", borderRadius: 12, background: checked ? "#eff6ff" : "#fff", cursor: savingId ? "wait" : "pointer" }}>
                <input type="checkbox" checked={checked} disabled={Boolean(savingId)} onChange={(e) => void toggle(assistant.user_id, e.target.checked)} />
                <span>
                  <strong style={{ display: "block" }}>{assistant.full_name}</strong>
                  <small className="muted">@{assistant.username}{assistant.program_study ? ` · ${assistant.program_study}` : ""}</small>
                </span>
              </label>
            );
          })}
        </div>

        {!loading && assistants.length === 0 && <div className="empty-state" style={{ marginTop: 12 }}>Belum ada akun Asisten Dosen. Super Admin perlu membuat akun Asdos terlebih dahulu.</div>}
        {loading && <div className="empty-state" style={{ marginTop: 12 }}>Memuat daftar Asisten Dosen...</div>}
      </div>
    </div>
  );
}
