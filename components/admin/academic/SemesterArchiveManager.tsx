"use client";

import { useEffect, useMemo, useState } from "react";
import type { Course } from "@/lib/types";

type ArchiveCourse = Course & {
  is_archived?: boolean;
  archived_at?: string | null;
};

type Props = {
  courses: ArchiveCourse[];
  onChanged: (course: ArchiveCourse) => void;
};

export default function SemesterArchiveManager({ courses, onChanged }: Props) {
  const [allCourses, setAllCourses] = useState<ArchiveCourse[]>(courses);
  const [mode, setMode] = useState<"active" | "archive">("archive");
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadAllCourses() {
      try {
        const response = await fetch("/api/admin/archive", { cache: "no-store" });
        const result = await response.json().catch(() => ({}));
        if (response.ok && !cancelled) {
          setAllCourses((result.courses ?? []) as ArchiveCourse[]);
        }
      } catch {
        // Tetap gunakan courses dari parent sebagai fallback.
      }
    }

    void loadAllCourses();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setAllCourses((current) => {
      const map = new Map(current.map((course) => [course.id, course]));
      for (const course of courses) map.set(course.id, course);
      return Array.from(map.values());
    });
  }, [courses]);

  const grouped = useMemo(() => {
    return allCourses
      .filter((course) =>
        mode === "archive" ? Boolean(course.is_archived) : !course.is_archived,
      )
      .sort((a, b) => {
        const year = String(b.academic_year).localeCompare(
          String(a.academic_year),
        );
        if (year !== 0) return year;
        return String(a.name).localeCompare(String(b.name), "id");
      });
  }, [allCourses, mode]);

  async function changeArchive(course: ArchiveCourse, archived: boolean) {
    setSavingId(course.id);
    setMessage("");

    try {
      const response = await fetch("/api/admin/archive", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_id: course.id, archived }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Gagal mengubah arsip.");

      const updated = result.course as ArchiveCourse;
      setAllCourses((items) =>
        items.some((item) => item.id === updated.id)
          ? items.map((item) => (item.id === updated.id ? updated : item))
          : [...items, updated],
      );
      onChanged(updated);
      setMessage(
        archived
          ? "Kelas dipindahkan ke arsip."
          : "Kelas berhasil dipulihkan ke semester aktif.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal mengubah arsip.");
    } finally {
      setSavingId("");
    }
  }

  return (
    <section className="panel academic-feature-panel">
      <div className="panel-head">
        <div>
          <h2>Semester Archive</h2>
          <p>
            Simpan kelas semester lama tanpa menghapus mahasiswa, absensi,
            nilai, jadwal, atau riwayat audit.
          </p>
        </div>

        <div className="admin-actions">
          <button
            type="button"
            className={mode === "active" ? "btn btn-primary" : "btn btn-secondary"}
            onClick={() => setMode("active")}
          >
            Semester Aktif
          </button>
          <button
            type="button"
            className={mode === "archive" ? "btn btn-primary" : "btn btn-secondary"}
            onClick={() => setMode("archive")}
          >
            Arsip
          </button>
        </div>
      </div>

      <div className="panel-body">
        {message && <div className="success" style={{ marginBottom: 14 }}>{message}</div>}

        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Mata Kuliah</th>
                <th>Kelas</th>
                <th>Dosen</th>
                <th>Semester</th>
                <th>Tahun Akademik</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((course) => (
                <tr key={course.id}>
                  <td><strong>{course.name}</strong></td>
                  <td>{course.class_name}</td>
                  <td>{course.lecturer}</td>
                  <td>{course.semester}</td>
                  <td>{course.academic_year}</td>
                  <td>
                    <span className={`badge ${course.is_archived ? "neutral" : "good"}`}>
                      {course.is_archived ? "Diarsipkan" : "Aktif"}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className={course.is_archived ? "btn btn-primary btn-small" : "btn btn-secondary btn-small"}
                      disabled={savingId === course.id}
                      onClick={() => void changeArchive(course, !course.is_archived)}
                    >
                      {savingId === course.id
                        ? "Memproses..."
                        : course.is_archived
                          ? "Pulihkan"
                          : "Arsipkan"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!grouped.length && (
          <div className="empty-state">
            {mode === "archive"
              ? "Belum ada kelas yang diarsipkan."
              : "Tidak ada kelas aktif."}
          </div>
        )}
      </div>
    </section>
  );
}
