"use client";

import {
  buildAttendanceMap,
  formatShortDate,
  getHeldMeetingIds,
  getStudentRecap,
} from "@/lib/attendance";
import { buildGradeMap, calculateFinalScore } from "@/lib/grades";
import type {
  Assessment,
  Attendance,
  Course,
  Grade,
  Meeting,
  Student,
} from "@/lib/types";
import { useMemo, useState } from "react";
import PrintAttendance from "@/components/admin/PrintAttendance";

type Props = {
  courses: Course[];
  students: Student[];
  meetings: Meeting[];
  attendance: Attendance[];
  assessments: Assessment[];
  grades: Grade[];
};

export default function RekapDashboard({
  courses,
  students,
  meetings,
  attendance,
  assessments,
  grades,
}: Props) {
  /*
   * Penting:
   * halaman tidak lagi otomatis memilih dosen/kelas pertama.
   * Rekap baru muncul setelah pengguna memilih:
   * 1. Dosen
   * 2. Kelas / mata kuliah
   */
  const [selectedLecturer, setSelectedLecturer] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [tab, setTab] = useState<"attendance" | "grades">("attendance");

  const lecturers = useMemo(() => {
    return Array.from(
      new Set(
        courses
          .map((item) => item.lecturer?.trim())
          .filter((value): value is string => Boolean(value)),
      ),
    ).sort((a, b) => a.localeCompare(b, "id"));
  }, [courses]);

  const lecturerCourses = useMemo(() => {
    if (!selectedLecturer) return [];

    return courses
      .filter((item) => item.lecturer?.trim() === selectedLecturer)
      .sort((a, b) => {
        const nameCompare = a.name.localeCompare(b.name, "id");
        if (nameCompare !== 0) return nameCompare;
        return a.class_name.localeCompare(b.class_name, "id");
      });
  }, [courses, selectedLecturer]);

  const course = useMemo(() => {
    if (!selectedLecturer || !selectedCourseId) return undefined;

    return courses.find(
      (item) =>
        item.id === selectedCourseId &&
        item.lecturer?.trim() === selectedLecturer,
    );
  }, [courses, selectedLecturer, selectedCourseId]);

  const courseStudents = useMemo(
    () =>
      course
        ? students.filter((item) => item.course_id === course.id)
        : [],
    [students, course],
  );

  const courseMeetings = useMemo(
    () =>
      course
        ? meetings
            .filter((item) => item.course_id === course.id)
            .sort((a, b) => a.meeting_no - b.meeting_no)
        : [],
    [meetings, course],
  );

  const meetingIds = useMemo(
    () => new Set(courseMeetings.map((item) => item.id)),
    [courseMeetings],
  );

  const courseAttendance = useMemo(
    () => attendance.filter((item) => meetingIds.has(item.meeting_id)),
    [attendance, meetingIds],
  );

  const courseAssessments = useMemo(
    () =>
      course
        ? assessments
            .filter((item) => item.course_id === course.id)
            .sort((a, b) => a.sort_order - b.sort_order)
        : [],
    [assessments, course],
  );

  const assessmentIds = useMemo(
    () => new Set(courseAssessments.map((item) => item.id)),
    [courseAssessments],
  );

  const courseGrades = useMemo(
    () => grades.filter((item) => assessmentIds.has(item.assessment_id)),
    [grades, assessmentIds],
  );

  const attendanceMap = buildAttendanceMap(courseAttendance);
  const heldMeetingIds = getHeldMeetingIds(courseAttendance);
  const heldCount = heldMeetingIds.size;

  const totalPresent = courseAttendance.filter(
    (item) => item.status === "H",
  ).length;

  const avgAttendance =
    heldCount && courseStudents.length
      ? Math.round(
          (totalPresent / (heldCount * courseStudents.length)) * 100,
        )
      : 0;

  const gradeMap = buildGradeMap(courseGrades);

  const totalWeight = courseAssessments.reduce(
    (sum, item) => sum + Number(item.weight),
    0,
  );

  function handleLecturerChange(lecturer: string) {
    setSelectedLecturer(lecturer);

    // Jangan otomatis memilih kelas.
    // User harus memilih kelas secara eksplisit.
    setSelectedCourseId("");
    setTab("attendance");
  }

  function handleCourseChange(courseId: string) {
    setSelectedCourseId(courseId);
    setTab("attendance");
  }

  if (courses.length === 0) {
    return (
      <section className="page rekap-page">
        <div className="shell rekap-shell">
          <div className="portal-empty-card">
            <div className="portal-empty-icon">📚</div>
            <h2>Belum ada kelas</h2>
            <p>
              Belum ada mata kuliah yang tersedia untuk ditampilkan pada
              halaman rekap.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="page rekap-page">
      <div className="shell rekap-shell">
        {/* ======================================================
            HEADER PORTAL — TERINSPIRASI LAYOUT SIAKAD
            ====================================================== */}
        <div className="portal-header">
          <div className="portal-brand">
            <div className="portal-emblem">UTI</div>

            <div>
              <div className="portal-kicker">PORTAL AKADEMIK</div>
              <h1>Rekap Akademik Mahasiswa</h1>
              <p>UNIVERSITAS TEKNOKRAT INDONESIA</p>
            </div>
          </div>
        </div>

        {/* ======================================================
            AREA AWAL
            Rekap belum ditampilkan sampai kelas dipilih.
            ====================================================== */}
        <div className="portal-start-grid">
          <section className="portal-welcome-card">
            <div className="portal-section-title">Selamat Datang</div>

            <div className="portal-welcome-body">
              <h2>Rekap Absensi & Nilai</h2>

              <p>
                Halaman ini digunakan untuk melihat rekap akademik kelas yang
                sudah tersedia pada sistem.
              </p>

              <div className="portal-guide">
                <div className="portal-guide-row">
                  <span className="portal-step">1</span>
                  <div>
                    <strong>Pilih dosen pengampu</strong>
                    <small>
                      Daftar mata kuliah akan disesuaikan dengan dosen yang
                      dipilih.
                    </small>
                  </div>
                </div>

                <div className="portal-guide-row">
                  <span className="portal-step">2</span>
                  <div>
                    <strong>Pilih kelas / mata kuliah</strong>
                    <small>
                      Detail kelas dan rekap baru akan dibuka setelah kelas
                      dipilih.
                    </small>
                  </div>
                </div>

                <div className="portal-guide-row">
                  <span className="portal-step">3</span>
                  <div>
                    <strong>Lihat rekap</strong>
                    <small>
                      Gunakan tab Rekap Absensi atau Rekap Nilai sesuai
                      kebutuhan.
                    </small>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <aside className="portal-selection-card">
            <div className="portal-section-title">Pilih Kelas</div>

            <div className="portal-selection-body">
              <div className="portal-field">
                <label htmlFor="rekap-lecturer">Dosen Pengampu</label>

                <select
                  id="rekap-lecturer"
                  className="select portal-select"
                  value={selectedLecturer}
                  onChange={(event) =>
                    handleLecturerChange(event.target.value)
                  }
                >
                  <option value="">— Pilih Dosen Pengampu —</option>

                  {lecturers.map((lecturer) => (
                    <option key={lecturer} value={lecturer}>
                      {lecturer}
                    </option>
                  ))}
                </select>
              </div>

              <div className="portal-field">
                <label htmlFor="rekap-course">Kelas / Mata Kuliah</label>

                <select
                  id="rekap-course"
                  className="select portal-select"
                  value={selectedCourseId}
                  disabled={!selectedLecturer}
                  onChange={(event) =>
                    handleCourseChange(event.target.value)
                  }
                >
                  <option value="">
                    {selectedLecturer
                      ? "— Pilih Kelas / Mata Kuliah —"
                      : "— Pilih Dosen Terlebih Dahulu —"}
                  </option>

                  {lecturerCourses.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} — {item.class_name}
                    </option>
                  ))}
                </select>
              </div>

              <div
                className={`portal-selection-status ${
                  course ? "ready" : ""
                }`}
              >
                {course ? (
                  <>
                    <span>✓</span>
                    <div>
                      <strong>Kelas siap ditampilkan</strong>
                      <small>
                        {course.name} — {course.class_name}
                      </small>
                    </div>
                  </>
                ) : selectedLecturer ? (
                  <>
                    <span>2</span>
                    <div>
                      <strong>Langkah berikutnya</strong>
                      <small>Pilih kelas / mata kuliah.</small>
                    </div>
                  </>
                ) : (
                  <>
                    <span>1</span>
                    <div>
                      <strong>Mulai dari sini</strong>
                      <small>Pilih dosen pengampu.</small>
                    </div>
                  </>
                )}
              </div>
            </div>
          </aside>
        </div>

        {/* ======================================================
            EMPTY STATE
            Tidak ada data kelas yang dirender sebelum course valid.
            ====================================================== */}
        {!course ? (
          <section className="portal-placeholder">
            <div className="portal-placeholder-icon">🎓</div>

            <div>
              <h2>Silakan pilih dosen dan kelas</h2>
              <p>
                Informasi mata kuliah, statistik, absensi, nilai, dan tombol
                cetak akan muncul setelah kelas dipilih.
              </p>
            </div>
          </section>
        ) : (
          <>
            {/* ==================================================
                INFORMASI KELAS
                ================================================== */}
            <section className="portal-content-card">
              <div className="portal-section-title portal-title-row">
                <span>Informasi Kelas</span>

                <span className="portal-course-badge">
                  {course.semester} {course.academic_year}
                </span>
              </div>

              <div className="portal-info-grid">
                <div className="portal-info-item">
                  <span>Mata Kuliah</span>
                  <strong>{course.name}</strong>
                </div>

                <div className="portal-info-item">
                  <span>Kelas</span>
                  <strong>{course.class_name}</strong>
                </div>

                <div className="portal-info-item">
                  <span>Dosen Pengampu</span>
                  <strong>{course.lecturer}</strong>
                </div>

                <div className="portal-info-item">
                  <span>Jadwal</span>
                  <strong>{course.schedule || "—"}</strong>
                </div>
              </div>
            </section>

            {/* ==================================================
                STATISTIK
                ================================================== */}
            <div className="portal-stat-grid">
              <div className="portal-stat-card">
                <span className="portal-stat-icon">👥</span>
                <div>
                  <strong>{courseStudents.length}</strong>
                  <span>Mahasiswa</span>
                </div>
              </div>

              <div className="portal-stat-card">
                <span className="portal-stat-icon">📅</span>
                <div>
                  <strong>
                    {heldCount}/
                    {courseMeetings.length || course.meeting_count}
                  </strong>
                  <span>Pertemuan terlaksana</span>
                </div>
              </div>

              <div className="portal-stat-card">
                <span className="portal-stat-icon">📊</span>
                <div>
                  <strong>{avgAttendance}%</strong>
                  <span>Rata-rata kehadiran</span>
                </div>
              </div>

              <div className="portal-stat-card portal-stat-highlight">
                <span className="portal-stat-icon">✓</span>
                <div>
                  <strong>{course.min_attendance_pct}%</strong>
                  <span>Batas minimal kehadiran</span>
                </div>
              </div>
            </div>

            {/* ==================================================
                AKSI & TAB
                ================================================== */}
            <div className="portal-action-row">
              <div className="rekap-print-wrap">
                <PrintAttendance
                  course={course}
                  students={students}
                  meetings={meetings}
                  attendance={attendance}
                />
              </div>

              <div className="tab-bar rekap-tabs portal-tabs">
                <button
                  type="button"
                  className={`tab-btn ${
                    tab === "attendance" ? "active" : ""
                  }`}
                  onClick={() => setTab("attendance")}
                >
                  Rekap Absensi
                </button>

                <button
                  type="button"
                  className={`tab-btn ${
                    tab === "grades" ? "active" : ""
                  }`}
                  onClick={() => setTab("grades")}
                >
                  Rekap Nilai
                </button>
              </div>
            </div>

            {/* ==================================================
                ABSENSI
                ================================================== */}
            {tab === "attendance" ? (
              <div className="panel rekap-panel portal-data-panel">
                <div className="panel-head rekap-panel-head">
                  <div>
                    <h2>Rekap Absensi</h2>
                    <p>H = Hadir, I = Izin, S = Sakit, A = Alfa.</p>
                  </div>

                  <span className="portal-panel-meta">
                    {courseStudents.length} Mahasiswa
                  </span>
                </div>

                <div className="rekap-mobile-hint" aria-hidden="true">
                  ← Geser tabel ke kanan/kiri untuk melihat P1–P16 dan status →
                </div>

                <div className="table-wrap rekap-table-scroll">
                  <table className="attendance-table rekap-table">
                    <thead>
                      <tr>
                        <th className="sticky-no">No</th>
                        <th className="sticky-npm">NPM</th>
                        <th className="sticky-name">Nama Mahasiswa</th>

                        {courseMeetings.map((meeting) => (
                          <th className="meeting-col" key={meeting.id}>
                            {meeting.meeting_no}
                            <span className="date">
                              {formatShortDate(meeting.meeting_date)}
                            </span>
                          </th>
                        ))}

                        <th>H</th>
                        <th>I</th>
                        <th>S</th>
                        <th>A</th>
                        <th>% Hadir</th>
                        <th>Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {courseStudents.map((student, index) => {
                        const recap = getStudentRecap(
                          student,
                          courseMeetings,
                          attendanceMap,
                          heldMeetingIds,
                        );

                        return (
                          <tr key={student.id}>
                            <td className="sticky-no">{index + 1}</td>
                            <td className="sticky-npm">{student.npm}</td>

                            <td className="sticky-name">
                              <strong>{student.name}</strong>
                            </td>

                            {courseMeetings.map((meeting) => {
                              const status = attendanceMap.get(
                                `${meeting.id}:${student.id}`,
                              );

                              return (
                                <td key={meeting.id}>
                                  {status ? (
                                    <span
                                      className={`status-dot status-${status}`}
                                    >
                                      {status}
                                    </span>
                                  ) : (
                                    <span className="status-empty">–</span>
                                  )}
                                </td>
                              );
                            })}

                            <td>{recap.H}</td>
                            <td>{recap.I}</td>
                            <td>{recap.S}</td>
                            <td>{recap.A}</td>

                            <td>
                              <strong>{recap.percentage}%</strong>
                            </td>

                            <td>
                              {recap.held === 0 ? (
                                <span className="badge neutral">
                                  Belum ada data
                                </span>
                              ) : recap.percentage >=
                                course.min_attendance_pct ? (
                                <span className="badge good">Memenuhi</span>
                              ) : (
                                <span className="badge warn">
                                  Belum memenuhi
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* ================================================
                 NILAI
                 ================================================ */
              <div className="panel rekap-panel portal-data-panel">
                <div className="panel-head rekap-panel-head">
                  <div>
                    <h2>Rekap Nilai</h2>
                    <p>
                      Nilai akhir dihitung berdasarkan bobot masing-masing
                      komponen.
                    </p>
                  </div>

                  {course.publish_grades && (
                    <span
                      className={`badge ${
                        totalWeight === 100 ? "good" : "warn"
                      }`}
                    >
                      Total bobot {totalWeight}%
                    </span>
                  )}
                </div>

                {!course.publish_grades ? (
                  <div className="panel-body">
                    <div className="privacy-note">
                      <strong>Nilai belum dipublikasikan.</strong>
                      <span>
                        Admin masih menyimpan rekap nilai sebagai data internal.
                      </span>
                    </div>
                  </div>
                ) : courseAssessments.length === 0 ? (
                  <div className="panel-body muted">
                    Belum ada komponen nilai.
                  </div>
                ) : (
                  <>
                    <div className="rekap-mobile-hint" aria-hidden="true">
                      ← Geser tabel ke kanan/kiri untuk melihat seluruh komponen
                      nilai →
                    </div>

                    <div className="table-wrap rekap-table-scroll">
                      <table className="attendance-table grade-table rekap-table rekap-grade-table">
                        <thead>
                          <tr>
                            <th className="sticky-no">No</th>
                            <th className="sticky-npm">NPM</th>
                            <th className="sticky-name">Nama Mahasiswa</th>

                            {courseAssessments.map((item) => (
                              <th key={item.id}>
                                {item.name}
                                <span className="date">
                                  Bobot {item.weight}%
                                </span>
                              </th>
                            ))}

                            <th>Nilai Akhir</th>
                            <th>Kelengkapan</th>
                          </tr>
                        </thead>

                        <tbody>
                          {courseStudents.map((student, index) => {
                            const final = calculateFinalScore(
                              student.id,
                              courseAssessments,
                              gradeMap,
                            );

                            return (
                              <tr key={student.id}>
                                <td className="sticky-no">{index + 1}</td>
                                <td className="sticky-npm">{student.npm}</td>

                                <td className="sticky-name">
                                  <strong>{student.name}</strong>
                                </td>

                                {courseAssessments.map((item) => {
                                  const score = gradeMap.get(
                                    `${item.id}:${student.id}`,
                                  );

                                  return (
                                    <td key={item.id}>
                                      {score === undefined ? "–" : score}
                                    </td>
                                  );
                                })}

                                <td>
                                  <strong>{final.score.toFixed(2)}</strong>
                                </td>

                                <td>
                                  <span
                                    className={`badge ${
                                      final.completed === final.total
                                        ? "good"
                                        : "neutral"
                                    }`}
                                  >
                                    {final.completed}/{final.total}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <style jsx global>{`
        /* =========================================================
           MODERN SIAKAD-LIKE REKAP
           Tidak mengubah fungsi/database.
           ========================================================= */

        .rekap-page {
          min-height: 100vh;
          background:
            linear-gradient(180deg, #edf2f7 0, #f7f9fc 240px, #f7f9fc 100%);
          overflow-x: hidden;
        }

        .rekap-shell {
          width: min(1480px, calc(100% - 32px)) !important;
          max-width: 1480px !important;
          margin: 0 auto;
          padding-top: 22px !important;
          padding-bottom: 50px !important;
        }

        .portal-header {
          overflow: hidden;
          border: 1px solid #970000;
          border-radius: 16px 16px 0 0;
          background:
            linear-gradient(135deg, #a90000 0%, #c60000 62%, #8d0000 100%);
          color: #fff;
          box-shadow: 0 12px 35px rgba(58, 72, 88, 0.12);
        }

        .portal-brand {
          min-height: 88px;
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 18px 24px;
        }

        .portal-emblem {
          width: 52px;
          height: 52px;
          flex: 0 0 52px;
          display: grid;
          place-items: center;
          border: 3px solid rgba(255, 255, 255, 0.92);
          border-radius: 50%;
          background: #fff;
          color: #a90000;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: -0.4px;
          box-shadow: inset 0 0 0 2px #a90000;
        }

        .portal-kicker {
          margin-bottom: 3px;
          color: #ffe3a8;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 1.6px;
        }

        .portal-brand h1 {
          margin: 0;
          color: #fff;
          font-family: Georgia, "Times New Roman", serif;
          font-size: clamp(22px, 3vw, 32px);
          line-height: 1.1;
        }

        .portal-brand p {
          margin: 4px 0 0;
          color: rgba(255, 255, 255, 0.88);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.3px;
        }

        .portal-start-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.45fr) minmax(330px, 0.8fr);
          gap: 16px;
          padding: 16px;
          border: 1px solid #d8e0e8;
          border-top: 0;
          background: #fff;
          border-radius: 0 0 16px 16px;
          box-shadow: 0 12px 35px rgba(58, 72, 88, 0.1);
          margin-bottom: 18px;
        }

        .portal-welcome-card,
        .portal-selection-card,
        .portal-content-card,
        .portal-data-panel {
          border: 1px solid #d8e1ea !important;
          border-radius: 12px !important;
          background: #fff !important;
          box-shadow: none !important;
        }

        .portal-section-title {
          min-height: 38px;
          display: flex;
          align-items: center;
          padding: 9px 14px;
          border-bottom: 1px solid #d7e0e8;
          background: linear-gradient(180deg, #fbf6e3 0%, #fffdf5 100%);
          color: #9a5c00;
          font-family: Georgia, "Times New Roman", serif;
          font-size: 14px;
          font-weight: 800;
        }

        .portal-welcome-body {
          padding: 18px;
        }

        .portal-welcome-body h2 {
          margin: 0 0 7px;
          color: #0c4a8a;
          font-size: 18px;
        }

        .portal-welcome-body > p {
          max-width: 780px;
          margin: 0;
          color: #5d6977;
          font-size: 14px;
          line-height: 1.7;
        }

        .portal-guide {
          display: grid;
          gap: 10px;
          margin-top: 18px;
        }

        .portal-guide-row {
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 10px 12px;
          border: 1px solid #e5ebf1;
          border-radius: 10px;
          background: #f8fafc;
        }

        .portal-step {
          width: 30px;
          height: 30px;
          flex: 0 0 30px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #0c4a8a;
          color: #fff;
          font-size: 12px;
          font-weight: 900;
        }

        .portal-guide-row strong,
        .portal-guide-row small {
          display: block;
        }

        .portal-guide-row strong {
          color: #182536;
          font-size: 13px;
        }

        .portal-guide-row small {
          margin-top: 2px;
          color: #728094;
          font-size: 11px;
          line-height: 1.4;
        }

        .portal-selection-body {
          padding: 16px;
        }

        .portal-field + .portal-field {
          margin-top: 13px;
        }

        .portal-field label {
          display: block;
          margin-bottom: 6px;
          color: #263b52;
          font-size: 12px;
          font-weight: 800;
        }

        .portal-select {
          width: 100% !important;
          min-height: 45px;
          border-radius: 9px !important;
          background: #fff !important;
        }

        .portal-select:disabled {
          cursor: not-allowed;
          background: #f2f5f8 !important;
          color: #8491a0;
        }

        .portal-selection-status {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 15px;
          padding: 11px 12px;
          border-radius: 10px;
          background: #fff7e1;
          color: #7d5700;
        }

        .portal-selection-status > span {
          width: 28px;
          height: 28px;
          flex: 0 0 28px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #f7c948;
          color: #593d00;
          font-size: 12px;
          font-weight: 900;
        }

        .portal-selection-status.ready {
          background: #eaf8f0;
          color: #157044;
        }

        .portal-selection-status.ready > span {
          background: #1f9d63;
          color: #fff;
        }

        .portal-selection-status strong,
        .portal-selection-status small {
          display: block;
        }

        .portal-selection-status strong {
          font-size: 12px;
        }

        .portal-selection-status small {
          margin-top: 2px;
          opacity: 0.85;
          font-size: 10px;
        }

        .portal-placeholder {
          min-height: 220px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 18px;
          padding: 30px;
          border: 1px dashed #bfcbd7;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.78);
          text-align: left;
        }

        .portal-placeholder-icon {
          font-size: 42px;
        }

        .portal-placeholder h2 {
          margin: 0 0 6px;
          color: #223247;
          font-size: 20px;
        }

        .portal-placeholder p {
          max-width: 620px;
          margin: 0;
          color: #728094;
          font-size: 13px;
          line-height: 1.6;
        }

        .portal-content-card {
          overflow: hidden;
          margin-bottom: 14px;
        }

        .portal-title-row {
          justify-content: space-between;
          gap: 12px;
        }

        .portal-course-badge {
          padding: 5px 9px;
          border-radius: 999px;
          background: #fff;
          color: #6f5207;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 10px;
          font-weight: 800;
        }

        .portal-info-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0;
        }

        .portal-info-item {
          min-width: 0;
          min-height: 82px;
          padding: 15px 17px;
          border-right: 1px solid #e1e7ed;
        }

        .portal-info-item:last-child {
          border-right: 0;
        }

        .portal-info-item span,
        .portal-info-item strong {
          display: block;
        }

        .portal-info-item span {
          margin-bottom: 7px;
          color: #7a8797;
          font-size: 11px;
        }

        .portal-info-item strong {
          color: #1e2938;
          font-size: 14px;
          line-height: 1.4;
          overflow-wrap: anywhere;
        }

        .portal-stat-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 14px;
        }

        .portal-stat-card {
          min-width: 0;
          min-height: 96px;
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 16px;
          border: 1px solid #d9e2eb;
          border-radius: 12px;
          background: #fff;
        }

        .portal-stat-icon {
          width: 40px;
          height: 40px;
          flex: 0 0 40px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: #edf4fb;
          font-size: 17px;
        }

        .portal-stat-card strong,
        .portal-stat-card span:not(.portal-stat-icon) {
          display: block;
        }

        .portal-stat-card strong {
          color: #182435;
          font-size: 24px;
          line-height: 1;
        }

        .portal-stat-card span:not(.portal-stat-icon) {
          margin-top: 5px;
          color: #748194;
          font-size: 11px;
        }

        .portal-stat-highlight {
          border-color: #123f65;
          background: #123f65;
        }

        .portal-stat-highlight .portal-stat-icon {
          background: rgba(255, 255, 255, 0.14);
        }

        .portal-stat-highlight strong,
        .portal-stat-highlight span:not(.portal-stat-icon) {
          color: #fff;
        }

        .portal-action-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin: 16px 0;
        }

        .portal-tabs {
          margin: 0 !important;
        }

        .portal-panel-meta {
          padding: 6px 10px;
          border-radius: 999px;
          background: #edf3f8;
          color: #526578;
          font-size: 10px;
          font-weight: 800;
        }

        .portal-data-panel {
          overflow: hidden;
        }

        .rekap-mobile-hint {
          display: none;
        }

        .rekap-table-scroll {
          display: block;
          width: 100%;
          max-width: 100%;
          overflow-x: auto !important;
          overflow-y: hidden;
          overscroll-behavior-x: contain;
          -webkit-overflow-scrolling: touch;
          touch-action: pan-x pan-y;
        }

        .rekap-table {
          width: max-content !important;
          min-width: 100%;
          border-collapse: separate;
          border-spacing: 0;
        }

        .rekap-table th,
        .rekap-table td {
          white-space: nowrap;
        }

        .rekap-table .meeting-col {
          min-width: 64px;
          text-align: center;
        }

        .rekap-table .meeting-col .date,
        .rekap-table th .date {
          display: block;
          margin-top: 3px;
          font-size: 9px;
          white-space: nowrap;
        }

        .portal-empty-card {
          max-width: 680px;
          margin: 80px auto;
          padding: 36px;
          border: 1px solid #d8e1ea;
          border-radius: 16px;
          background: #fff;
          text-align: center;
        }

        .portal-empty-icon {
          margin-bottom: 10px;
          font-size: 42px;
        }

        .portal-empty-card h2 {
          margin: 0 0 8px;
        }

        .portal-empty-card p {
          margin: 0;
          color: #718096;
        }

        @media (max-width: 980px) {
          .portal-start-grid {
            grid-template-columns: 1fr;
          }

          .portal-info-grid,
          .portal-stat-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .portal-info-item:nth-child(2) {
            border-right: 0;
          }

          .portal-info-item:nth-child(-n + 2) {
            border-bottom: 1px solid #e1e7ed;
          }
        }

        @media (max-width: 640px) {
          .rekap-shell {
            width: calc(100% - 16px) !important;
            padding-top: 8px !important;
          }

          .portal-header {
            border-radius: 12px 12px 0 0;
          }

          .portal-brand {
            min-height: 76px;
            gap: 11px;
            padding: 14px;
          }

          .portal-emblem {
            width: 43px;
            height: 43px;
            flex-basis: 43px;
            font-size: 10px;
          }

          .portal-brand h1 {
            font-size: 20px;
          }

          .portal-brand p {
            font-size: 9px;
          }

          .portal-kicker {
            font-size: 9px;
          }

          .portal-start-grid {
            padding: 10px;
            gap: 10px;
            border-radius: 0 0 12px 12px;
          }

          .portal-welcome-body,
          .portal-selection-body {
            padding: 13px;
          }

          .portal-welcome-body h2 {
            font-size: 17px;
          }

          .portal-guide-row {
            align-items: flex-start;
          }

          .portal-placeholder {
            min-height: 180px;
            flex-direction: column;
            padding: 24px 18px;
            text-align: center;
          }

          .portal-placeholder-icon {
            font-size: 34px;
          }

          .portal-info-grid,
          .portal-stat-grid {
            grid-template-columns: 1fr 1fr;
            gap: 9px;
          }

          .portal-info-grid {
            gap: 0;
          }

          .portal-info-item {
            min-height: 76px;
            padding: 12px;
          }

          .portal-info-item:nth-child(odd) {
            border-right: 1px solid #e1e7ed;
          }

          .portal-info-item:nth-child(even) {
            border-right: 0;
          }

          .portal-stat-card {
            min-height: 86px;
            gap: 9px;
            padding: 12px 10px;
          }

          .portal-stat-icon {
            width: 34px;
            height: 34px;
            flex-basis: 34px;
            font-size: 14px;
          }

          .portal-stat-card strong {
            font-size: 20px;
          }

          .portal-action-row {
            align-items: stretch;
            flex-direction: column;
          }

          .rekap-print-wrap {
            width: 100%;
            max-width: 100%;
            overflow-x: auto;
          }

          .portal-tabs {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            width: 100% !important;
            gap: 8px !important;
          }

          .portal-tabs .tab-btn {
            width: 100% !important;
            min-width: 0 !important;
            text-align: center;
          }

          .rekap-panel {
            min-width: 0 !important;
            overflow: hidden;
          }

          .rekap-panel-head {
            padding: 15px 13px !important;
          }

          .rekap-panel-head h2 {
            font-size: 18px !important;
          }

          .rekap-panel-head p {
            font-size: 11px !important;
          }

          .portal-panel-meta {
            display: none;
          }

          .rekap-mobile-hint {
            display: block;
            margin: 10px 10px 7px;
            padding: 8px 9px;
            border-radius: 8px;
            background: #eef5fb;
            color: #0c4a8a;
            font-size: 10px;
            font-weight: 800;
            line-height: 1.4;
            text-align: center;
          }

          .rekap-table {
            width: max-content !important;
            min-width: max-content !important;
          }

          .rekap-table th,
          .rekap-table td {
            padding: 9px 7px !important;
            font-size: 11px !important;
          }

          /*
           * Sticky dimatikan khusus HP agar seluruh P1-P16
           * dapat digeser horizontal.
           */
          .rekap-table .sticky-no,
          .rekap-table .sticky-npm,
          .rekap-table .sticky-name {
            position: static !important;
            left: auto !important;
            right: auto !important;
            z-index: auto !important;
          }

          .rekap-table .sticky-no {
            min-width: 42px !important;
            width: 42px !important;
            text-align: center !important;
          }

          .rekap-table .sticky-npm {
            min-width: 95px !important;
            width: 95px !important;
          }

          .rekap-table .sticky-name {
            min-width: 175px !important;
            width: 175px !important;
            max-width: 175px !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }

          .rekap-table .meeting-col,
          .rekap-table
            tbody
            td:not(.sticky-no):not(.sticky-npm):not(.sticky-name) {
            min-width: 53px;
            text-align: center;
          }

          .rekap-grade-table
            th:not(.sticky-no):not(.sticky-npm):not(.sticky-name),
          .rekap-grade-table
            td:not(.sticky-no):not(.sticky-npm):not(.sticky-name) {
            min-width: 90px;
          }
        }

        @media (max-width: 390px) {
          .portal-info-grid,
          .portal-stat-grid {
            grid-template-columns: 1fr;
          }

          .portal-info-item {
            border-right: 0 !important;
            border-bottom: 1px solid #e1e7ed;
          }

          .portal-info-item:last-child {
            border-bottom: 0;
          }

          .portal-tabs {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
}
