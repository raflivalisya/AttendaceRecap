"use client";

import { useState } from "react";
import type { Course } from "@/lib/types";

type Props = { courses: Course[] };

type PrintType = "attendance" | "grades" | "meetings" | "summary";

export default function OfficialPrintCenter({ courses }: Props) {
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [type, setType] = useState<PrintType>("attendance");

  function openPrint() {
    if (!courseId) return;
    window.open(`/admin/print/${courseId}?type=${type}`, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="panel academic-feature-panel">
      <div className="panel-head">
        <div>
          <h2>Template Cetak Resmi</h2>
          <p>Cetak dokumen akademik menggunakan data yang sudah ada di sistem.</p>
        </div>
      </div>

      <div className="panel-body">
        <div className="academic-print-grid">
          <div className="field">
            <label>Kelas / Mata Kuliah</label>
            <select className="select" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              {courses.map((course) => (
                <option value={course.id} key={course.id}>
                  {course.name} — {course.class_name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Template</label>
            <select className="select" value={type} onChange={(e) => setType(e.target.value as PrintType)}>
              <option value="attendance">Rekap Absensi Mahasiswa</option>
              <option value="grades">Rekap Nilai</option>
              <option value="meetings">Jadwal / Daftar Pertemuan</option>
              <option value="summary">Ringkasan Kelas</option>
            </select>
          </div>

          <button type="button" className="btn btn-primary" disabled={!courseId} onClick={openPrint}>
            🖨 Buka Template Cetak
          </button>
        </div>

        <div className="academic-print-template-grid">
          <article>
            <span>01</span><strong>Absensi</strong><small>H/I/S/A per pertemuan dan persentase kehadiran.</small>
          </article>
          <article>
            <span>02</span><strong>Nilai</strong><small>Komponen, bobot, skor mahasiswa, dan nilai akhir.</small>
          </article>
          <article>
            <span>03</span><strong>Pertemuan</strong><small>Daftar P1–Pn beserta tanggal perkuliahan.</small>
          </article>
          <article>
            <span>04</span><strong>Ringkasan</strong><small>Identitas kelas, dosen, jadwal, dan statistik dasar.</small>
          </article>
        </div>
      </div>
    </section>
  );
}
