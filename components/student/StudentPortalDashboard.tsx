"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Assessment, Attendance, Course, Grade, Meeting, Student } from "@/lib/types";

type Schedule = {
  id: string;
  course_id: string;
  weekday: number;
  day_name: string;
  start_time: string;
  end_time: string;
  room: string | null;
};

type Payload = {
  profile: { npm: string; full_name: string };
  students: Student[];
  courses: Course[];
  meetings: Meeting[];
  attendance: Attendance[];
  assessments: Assessment[];
  grades: Grade[];
  schedules: Schedule[];
};

type Tab = "overview" | "attendance" | "grades" | "schedule";

function statusLabel(status: string | undefined) {
  if (status === "H") return "Hadir";
  if (status === "I") return "Izin";
  if (status === "S") return "Sakit";
  if (status === "A") return "Alfa";
  return "Belum ada data";
}

export default function StudentPortalDashboard() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [courseId, setCourseId] = useState("");
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/student/me", { cache: "no-store" });
        const result = await response.json().catch(() => ({}));
        if (response.status === 401) {
          router.replace("/student/login");
          return;
        }
        if (!response.ok) throw new Error(result.error || "Gagal memuat portal.");
        const payload = result as Payload;
        setData(payload);
        setCourseId(payload.courses[0]?.id ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat portal.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [router]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/student/login");
    router.refresh();
  }

  const selectedCourse = data?.courses.find((course) => course.id === courseId);
  const studentRow = data?.students.find((student) => student.course_id === courseId);
  const courseMeetings = (data?.meetings ?? []).filter((meeting) => meeting.course_id === courseId).sort((a,b) => a.meeting_no - b.meeting_no);
  const courseAssessments = (data?.assessments ?? []).filter((item) => item.course_id === courseId).sort((a,b) => a.sort_order - b.sort_order);
  const courseSchedules = (data?.schedules ?? []).filter((item) => item.course_id === courseId).sort((a,b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time));

  const attendanceRows = studentRow
    ? courseMeetings.map((meeting) => ({
        meeting,
        attendance: data?.attendance.find((item) => item.meeting_id === meeting.id && item.student_id === studentRow.id),
      }))
    : [];

  const heldRows = attendanceRows.filter((item) => item.attendance);
  const presentCount = heldRows.filter((item) => item.attendance?.status === "H").length;
  const percentage = heldRows.length ? Math.round((presentCount / heldRows.length) * 100) : 0;

  const weightedScore = studentRow && selectedCourse?.publish_grades
    ? courseAssessments.reduce((sum, assessment) => {
        const grade = data?.grades.find((item) => item.assessment_id === assessment.id && item.student_id === studentRow.id);
        if (!grade) return sum;
        const max = Number(assessment.max_score) || 100;
        return sum + (Number(grade.score) / max) * Number(assessment.weight);
      }, 0)
    : 0;

  if (loading) {
    return <main className="student-portal-page"><div className="student-loading">Memuat Student Portal...</div></main>;
  }

  if (error || !data) {
    return <main className="student-portal-page"><div className="student-error-card"><strong>Portal gagal dimuat</strong><p>{error}</p></div></main>;
  }

  return (
    <main className="student-portal-page">
      <div className="student-shell">
        <header className="student-header">
          <div className="student-header-brand">
            <div className="student-brand-mark">UTI</div>
            <div>
              <span>STUDENT PORTAL</span>
              <strong>{data.profile.full_name}</strong>
              <small>NPM {data.profile.npm}</small>
            </div>
          </div>
          <button type="button" onClick={() => void logout()}>Keluar</button>
        </header>

        <section className="student-course-select">
          <div>
            <span>Mata Kuliah</span>
            <strong>Pilih kelas untuk melihat data akademik</strong>
          </div>
          <select value={courseId} onChange={(e) => { setCourseId(e.target.value); setTab("overview"); }}>
            {data.courses.map((course) => (
              <option value={course.id} key={course.id}>
                {course.name} — {course.class_name}{(course as Course & {is_archived?:boolean}).is_archived ? " (Arsip)" : ""}
              </option>
            ))}
          </select>
        </section>

        {!selectedCourse || !studentRow ? (
          <div className="student-empty">Belum ada mata kuliah yang terhubung ke NPM ini.</div>
        ) : (
          <>
            {heldRows.length > 0 && percentage < Number(selectedCourse.min_attendance_pct) && (
              <section className="student-warning">
                <span>!</span>
                <div>
                  <strong>Kehadiran perlu perhatian</strong>
                  <p>Persentase hadir {percentage}% berada di bawah batas {selectedCourse.min_attendance_pct}%.</p>
                </div>
              </section>
            )}

            <section className="student-course-hero">
              <div>
                <span>{selectedCourse.semester} · {selectedCourse.academic_year}</span>
                <h1>{selectedCourse.name}</h1>
                <p>{selectedCourse.class_name} · {selectedCourse.lecturer}</p>
              </div>
              <div className="student-course-stats">
                <div><strong>{percentage}%</strong><span>Kehadiran</span></div>
                <div><strong>{heldRows.length}/{courseMeetings.length || selectedCourse.meeting_count}</strong><span>Pertemuan</span></div>
                <div><strong>{selectedCourse.publish_grades ? weightedScore.toFixed(2) : "—"}</strong><span>Nilai Akhir</span></div>
              </div>
            </section>

            <nav className="student-tabs">
              <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>Ringkasan</button>
              <button className={tab === "attendance" ? "active" : ""} onClick={() => setTab("attendance")}>Absensi</button>
              <button className={tab === "grades" ? "active" : ""} onClick={() => setTab("grades")}>Nilai</button>
              <button className={tab === "schedule" ? "active" : ""} onClick={() => setTab("schedule")}>Jadwal</button>
            </nav>

            {tab === "overview" && (
              <section className="student-overview-grid">
                <article><span>Hadir</span><strong>{presentCount}</strong></article>
                <article><span>Izin</span><strong>{heldRows.filter((x) => x.attendance?.status === "I").length}</strong></article>
                <article><span>Sakit</span><strong>{heldRows.filter((x) => x.attendance?.status === "S").length}</strong></article>
                <article><span>Alfa</span><strong>{heldRows.filter((x) => x.attendance?.status === "A").length}</strong></article>
              </section>
            )}

            {tab === "attendance" && (
              <section className="student-card">
                <div className="student-card-head"><h2>Riwayat Absensi</h2><span>{percentage}% hadir</span></div>
                <div className="student-table-wrap">
                  <table><thead><tr><th>Pertemuan</th><th>Tanggal</th><th>Status</th></tr></thead>
                    <tbody>{attendanceRows.map(({meeting, attendance}) => (
                      <tr key={meeting.id}><td>P{meeting.meeting_no}</td><td>{new Date(`${meeting.meeting_date}T00:00:00`).toLocaleDateString("id-ID")}</td><td><span className={`student-status status-${attendance?.status ?? "empty"}`}>{statusLabel(attendance?.status)}</span></td></tr>
                    ))}</tbody>
                  </table>
                </div>
              </section>
            )}

            {tab === "grades" && (
              <section className="student-card">
                <div className="student-card-head"><h2>Nilai</h2>{selectedCourse.publish_grades && <span>Nilai akhir {weightedScore.toFixed(2)}</span>}</div>
                {!selectedCourse.publish_grades ? (
                  <div className="student-private-note">Nilai belum dipublikasikan oleh dosen.</div>
                ) : (
                  <div className="student-table-wrap"><table><thead><tr><th>Komponen</th><th>Bobot</th><th>Nilai</th></tr></thead><tbody>{courseAssessments.map((assessment) => {
                    const grade = data.grades.find((item) => item.assessment_id === assessment.id && item.student_id === studentRow.id);
                    return <tr key={assessment.id}><td>{assessment.name}</td><td>{assessment.weight}%</td><td><strong>{grade?.score ?? "—"}</strong></td></tr>;
                  })}</tbody></table></div>
                )}
              </section>
            )}

            {tab === "schedule" && (
              <section className="student-card">
                <div className="student-card-head"><h2>Jadwal Kuliah</h2><span>{courseSchedules.length} slot/minggu</span></div>
                <div className="student-schedule-list">
                  {courseSchedules.map((slot) => (
                    <article key={slot.id}><strong>{slot.day_name}</strong><span>{slot.start_time.slice(0,5)}–{slot.end_time.slice(0,5)}</span><small>{slot.room || "Ruang belum diisi"}</small></article>
                  ))}
                  {!courseSchedules.length && <div className="student-empty">Jadwal terstruktur belum tersedia.</div>}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
