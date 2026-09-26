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

type Props = { courses: Course[] };

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
  return action;
}

export default function AuditLogViewer({ courses }: Props) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseId, setCourseId] = useState("");
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [expanded, setExpanded] = useState("");
  const [error, setError] = useState("");

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
            </select>
          </div>
        </div>

        {error && <div className="error" style={{ marginTop: 14 }}>{error}</div>}

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
