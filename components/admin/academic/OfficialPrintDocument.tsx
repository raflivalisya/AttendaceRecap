"use client";

import type { Assessment, Attendance, Course, Grade, Meeting, Student } from "@/lib/types";
import {
  resolveGradeLetter,
  type GradeLetterScale,
} from "@/lib/grade-letter";

type PrintType = "attendance" | "grades" | "meetings" | "summary";

type Props = {
  type: PrintType;
  course: Course;
  students: Student[];
  meetings: Meeting[];
  attendance: Attendance[];
  assessments: Assessment[];
  grades: Grade[];
  gradeScales: GradeLetterScale[];
};

export default function OfficialPrintDocument({ type, course, students, meetings, attendance, assessments, grades, gradeScales }: Props) {
  const meetingIds = new Set(meetings.map((m) => m.id));
  const heldIds = new Set(attendance.filter((a) => meetingIds.has(a.meeting_id)).map((a) => a.meeting_id));

  function studentPercentage(studentId: string) {
    if (!heldIds.size) return 0;
    let present = 0;
    for (const meetingId of heldIds) {
      if (attendance.find((a) => a.meeting_id === meetingId && a.student_id === studentId)?.status === "H") present += 1;
    }
    return Math.round((present / heldIds.size) * 100);
  }

  function finalScore(studentId: string) {
    return assessments.reduce((sum, assessment) => {
      const grade = grades.find((g) => g.assessment_id === assessment.id && g.student_id === studentId);
      if (!grade) return sum;
      return sum + (Number(grade.score) / Number(assessment.max_score || 100)) * Number(assessment.weight);
    }, 0);
  }

  return (
    <main className="official-print-page">
      <div className="official-print-actions">
        <button type="button" onClick={() => window.print()}>🖨 Print</button>
        <button type="button" onClick={() => window.close()}>Tutup</button>
      </div>

      <section className="official-sheet">
        <header className="official-head">
          <img src="/logo-teknokrat.png" alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} />
          <div>
            <strong>UNIVERSITAS TEKNOKRAT INDONESIA</strong>
            <span>DOKUMEN AKADEMIK</span>
          </div>
        </header>

        <h1>{type === "attendance" ? "REKAP ABSENSI MAHASISWA" : type === "grades" ? "REKAP NILAI MAHASISWA" : type === "meetings" ? "DAFTAR PERTEMUAN PERKULIAHAN" : "RINGKASAN KELAS"}</h1>

        <div className="official-identity">
          <div><span>Mata Kuliah</span><strong>{course.name}</strong></div>
          <div><span>Kelas</span><strong>{course.class_name}</strong></div>
          <div><span>Dosen</span><strong>{course.lecturer}</strong></div>
          <div><span>Semester</span><strong>{course.semester} · {course.academic_year}</strong></div>
        </div>

        {type === "attendance" && (
          <table><thead><tr><th>No</th><th>NPM</th><th>Nama</th>{meetings.map((m) => <th key={m.id}>P{m.meeting_no}</th>)}<th>%</th></tr></thead><tbody>{students.map((student, i) => <tr key={student.id}><td>{i+1}</td><td>{student.npm}</td><td>{student.name}</td>{meetings.map((m) => <td key={m.id}>{attendance.find((a) => a.meeting_id === m.id && a.student_id === student.id)?.status ?? "-"}</td>)}<td>{studentPercentage(student.id)}%</td></tr>)}</tbody></table>
        )}

        {type === "grades" && (
          <table><thead><tr><th>No</th><th>NPM</th><th>Nama</th>{assessments.map((a) => <th key={a.id}>{a.name}<small>{a.weight}%</small></th>)}<th>Akhir</th><th>Huruf</th></tr></thead><tbody>{students.map((student, i) => { const score = finalScore(student.id); return <tr key={student.id}><td>{i+1}</td><td>{student.npm}</td><td>{student.name}</td>{assessments.map((a) => <td key={a.id}>{grades.find((g) => g.assessment_id === a.id && g.student_id === student.id)?.score ?? "-"}</td>)}<td><strong>{score.toFixed(2)}</strong></td><td><strong>{resolveGradeLetter(score, gradeScales)}</strong></td></tr>; })}</tbody></table>
        )}

        {type === "meetings" && (
          <table><thead><tr><th>No</th><th>Pertemuan</th><th>Tanggal</th><th>Status Data Absensi</th></tr></thead><tbody>{meetings.map((m, i) => <tr key={m.id}><td>{i+1}</td><td>P{m.meeting_no}</td><td>{new Date(`${m.meeting_date}T00:00:00`).toLocaleDateString("id-ID")}</td><td>{heldIds.has(m.id) ? "Sudah ada data" : "Belum ada data"}</td></tr>)}</tbody></table>
        )}

        {type === "summary" && (
          <div className="official-summary-grid">
            <article><span>Mahasiswa</span><strong>{students.length}</strong></article>
            <article><span>Pertemuan</span><strong>{heldIds.size}/{meetings.length || course.meeting_count}</strong></article>
            <article><span>Jadwal</span><strong>{course.schedule || "—"}</strong></article>
            <article><span>Batas Kehadiran</span><strong>{course.min_attendance_pct}%</strong></article>
            <article><span>Komponen Nilai</span><strong>{assessments.length}</strong></article>
            <article><span>Nilai Dipublikasikan</span><strong>{course.publish_grades ? "Ya" : "Belum"}</strong></article>
          </div>
        )}

        <footer className="official-signature">
          <div><span>Mengetahui,</span><strong>{course.lecturer}</strong></div>
          <div><span>Administrator,</span><strong>________________________</strong></div>
        </footer>
      </section>

      <style jsx global>{`
        *{box-sizing:border-box}.official-print-page{min-height:100vh;background:#edf1f4;font-family:Arial,sans-serif;color:#111}.official-print-actions{width:min(277mm,calc(100% - 24px));margin:12px auto;display:flex;gap:8px}.official-print-actions button{padding:10px 14px;border:1px solid #ccd6df;border-radius:8px;background:#123f65;color:#fff;font-weight:700}.official-sheet{width:277mm;max-width:calc(100% - 24px);margin:0 auto 30px;padding:12mm;background:#fff;box-shadow:0 8px 30px rgba(0,0,0,.12)}.official-head{display:flex;align-items:center;gap:12px;border-bottom:2px solid #111;padding-bottom:8px}.official-head img{width:48px;height:48px;object-fit:contain}.official-head strong,.official-head span{display:block}.official-head strong{font-family:Georgia,serif;font-size:16px}.official-head span{margin-top:3px;font-size:9px;letter-spacing:1.2px}.official-sheet h1{text-align:center;font-family:Georgia,serif;font-size:16px;margin:8mm 0 6mm}.official-identity{display:grid;grid-template-columns:1fr 1fr;gap:5px 18px;margin-bottom:6mm}.official-identity div{display:grid;grid-template-columns:95px 1fr;font-size:10px}.official-identity span{color:#555}.official-sheet table{width:100%;border-collapse:collapse;font-size:8px}.official-sheet th,.official-sheet td{border:1px solid #333;padding:3px;text-align:center}.official-sheet th:nth-child(3),.official-sheet td:nth-child(3){text-align:left}.official-sheet th small{display:block;font-size:6px}.official-summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.official-summary-grid article{padding:14px;border:1px solid #bbb;border-radius:8px}.official-summary-grid span,.official-summary-grid strong{display:block}.official-summary-grid span{font-size:9px;color:#666}.official-summary-grid strong{margin-top:5px;font-size:14px}.official-signature{display:flex;justify-content:space-between;margin-top:14mm;font-size:9px}.official-signature div{width:60mm;text-align:center}.official-signature span,.official-signature strong{display:block}.official-signature strong{margin-top:18mm}@page{size:A4 landscape;margin:8mm}@media print{body{margin:0;background:#fff}.official-print-actions{display:none}.official-sheet{width:auto;max-width:none;margin:0;padding:0;box-shadow:none}.official-sheet table{font-size:7px}}
      `}</style>
    </main>
  );
}
