"use client";

import { useEffect, useMemo, useState } from "react";
import type { Course } from "@/lib/types";

type AuditLog = {
  id: string;
  actor_user_id: string | null;
  actor_name: string;
  course_id: string | null;
  entity_table: string;
  entity_id: string | null;
  action: string;
  summary: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
};

type Props = { courses: Course[]; canRecover?: boolean };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function actionLabel(action: string) {
  if (action === "INSERT") return "Tambah";
  if (action === "UPDATE") return "Ubah";
  if (action === "DELETE") return "Hapus";
  if (action === "ARCHIVE") return "Arsip";
  if (action === "AUTH") return "Akun";
  if (action === "RECOVER") return "Pulihkan";
  return action;
}

export default function AuditLogViewer({ courses, canRecover = false }: Props) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseId, setCourseId] = useState("");
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [expanded, setExpanded] = useState("");
  const [error, setError] = useState("");
  const [recoveringId, setRecoveringId] = useState("");
  const [success, setSuccess] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    if (courseId) params.set("course_id", courseId);
    if (entity) params.set("entity", entity);
    if (action) params.set("action", action);

    try {
      const response = await fetch(`/api/admin/audit?${params.toString()}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Gagal memuat audit log.");
      setLogs((result.logs ?? []) as AuditLog[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat audit log.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [courseId, entity, action]);

  async function recover(log: AuditLog) {
    if (!canRecover || recoveringId) return;
    const label = log.summary || `${actionLabel(log.action)} ${log.entity_table}`;
    if (!window.confirm(`Pulihkan perubahan ini?\n\n${label}\n\nSistem akan membuat audit log baru untuk tindakan recovery.`)) return;

    setRecoveringId(log.id);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin/audit/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audit_id: log.id }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Pemulihan gagal.");
      setSuccess(result.message || "Perubahan berhasil dipulihkan.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pemulihan gagal.");
    } finally {
      setRecoveringId("");
    }
  }

  function canRecoverLog(log: AuditLog) {
    if (!canRecover || !["INSERT", "UPDATE", "DELETE"].includes(log.action)) return false;
    if (!["courses", "students", "meetings", "attendance", "assessments", "grades", "course_schedules"].includes(log.entity_table)) return false;
    if (log.action === "INSERT") return Boolean(log.entity_id || log.new_data?.id);
    return Boolean(log.old_data);
  }

  const courseMap = useMemo(
    () => new Map(courses.map((course) => [course.id, course])),
    [courses],
  );

  return (
    <section className="panel academic-feature-panel">
      <div className="panel-head">
        <div>
          <h2>Audit Log</h2>
          <p>Riwayat perubahan data penting: kelas, mahasiswa, absensi, nilai, jadwal, dan akses.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => void load()}>
          ↻ Refresh
        </button>
      </div>

      <div className="panel-body">
        <div className="academic-filter-grid">
          <div className="field">
            <label>Kelas</label>
            <select className="select" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">Semua kelas</option>
              {courses.map((course) => (
                <option value={course.id} key={course.id}>
                  {course.name} — {course.class_name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Jenis Data</label>
            <select className="select" value={entity} onChange={(e) => setEntity(e.target.value)}>
              <option value="">Semua data</option>
              <option value="courses">Kelas</option>
              <option value="students">Mahasiswa</option>
              <option value="meetings">Pertemuan</option>
              <option value="attendance">Absensi</option>
              <option value="assessments">Komponen Nilai</option>
              <option value="grades">Nilai</option>
              <option value="course_schedules">Jadwal</option>
              <option value="course_members">Akses Kelas</option>
              <option value="student_portal_profiles">Akun Mahasiswa</option>
            </select>
          </div>

          <div className="field">
            <label>Aksi</label>
            <select className="select" value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="">Semua aksi</option>
              <option value="INSERT">Tambah</option>
              <option value="UPDATE">Ubah</option>
              <option value="DELETE">Hapus</option>
              <option value="ARCHIVE">Arsip</option>
              <option value="AUTH">Akun</option>
              <option value="RECOVER">Pulihkan</option>
            </select>
          </div>
        </div>

        {error && <div className="error" style={{ marginTop: 14 }}>{error}</div>}
        {success && <div className="success" style={{ marginTop: 14 }}>{success}</div>}

        <div className="academic-audit-list" style={{ marginTop: 16 }}>
          {loading ? (
            <div className="empty-state">Memuat audit log...</div>
          ) : logs.length ? (
            logs.map((log) => {
              const course = log.course_id ? courseMap.get(log.course_id) : undefined;
              const isOpen = expanded === log.id;

              return (
                <article className="academic-audit-item" key={log.id}>
                  <button
                    type="button"
                    className="academic-audit-summary"
                    onClick={() => setExpanded(isOpen ? "" : log.id)}
                  >
                    <span className={`academic-audit-action action-${log.action.toLowerCase()}`}>
                      {actionLabel(log.action)}
                    </span>

                    <span className="academic-audit-main">
                      <strong>{log.actor_name}</strong>
                      <span>
                        {log.summary || `${actionLabel(log.action)} ${log.entity_table}`}
                        {course ? ` · ${course.name} — ${course.class_name}` : ""}
                      </span>
                    </span>

                    <time>{formatDate(log.created_at)}</time>
                    <span>{isOpen ? "⌃" : "⌄"}</span>
                  </button>

                  {isOpen && (
                    <>
                      <div className="academic-audit-detail">
                        <div>
                          <strong>Data Sebelum</strong>
                          <pre>{JSON.stringify(log.old_data, null, 2) || "—"}</pre>
                        </div>
                        <div>
                          <strong>Data Sesudah</strong>
                          <pre>{JSON.stringify(log.new_data, null, 2) || "—"}</pre>
                        </div>
                      </div>
                      {canRecoverLog(log) && (
                        <div className="academic-audit-recovery">
                          <span className="muted">Recovery mengembalikan snapshot sebelumnya dan tetap tercatat di audit log.</span>
                          <button type="button" className="btn btn-warning" disabled={recoveringId === log.id} onClick={() => void recover(log)}>
                            {recoveringId === log.id ? "Memulihkan…" : "↶ Pulihkan perubahan"}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </article>
              );
            })
          ) : (
            <div className="empty-state">Belum ada audit log pada filter ini.</div>
          )}
        </div>
      </div>
    </section>
  );
}
