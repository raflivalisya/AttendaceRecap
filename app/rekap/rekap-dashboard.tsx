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
  const [selectedCourseId, setSelectedCourseId] = useState(
    courses[0]?.id ?? "",
  );

  const [selectedLecturer, setSelectedLecturer] = useState(
    courses[0]?.lecturer ?? "",
  );

  const [tab, setTab] = useState<"attendance" | "grades">("attendance");

  // Ambil daftar dosen tanpa duplikat.
  const lecturers = useMemo(() => {
    return Array.from(
      new Set(
        courses
          .map((item) => item.lecturer?.trim())
          .filter((value): value is string => Boolean(value)),
      ),
    ).sort();
  }, [courses]);

  // Filter mata kuliah berdasarkan dosen.
  const lecturerCourses = useMemo(() => {
    return courses.filter((item) => item.lecturer === selectedLecturer);
  }, [courses, selectedLecturer]);

  const course =
    courses.find((item) => item.id === selectedCourseId) ??
    lecturerCourses[0] ??
    courses[0];

  const courseStudents = useMemo(
    () => students.filter((item) => item.course_id === course?.id),
    [students, course?.id],
  );

  const courseMeetings = useMemo(
    () =>
      meetings
        .filter((item) => item.course_id === course?.id)
        .sort((a, b) => a.meeting_no - b.meeting_no),
    [meetings, course?.id],
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
      assessments
        .filter((item) => item.course_id === course?.id)
        .sort((a, b) => a.sort_order - b.sort_order),
    [assessments, course?.id],
  );

  const assessmentIds = useMemo(
    () => new Set(courseAssessments.map((item) => item.id)),
    [courseAssessments],
  );

  const courseGrades = useMemo(
    () => grades.filter((item) => assessmentIds.has(item.assessment_id)),
    [grades, assessmentIds],
  );

  if (!course) {
    return (
      <section className="page">
        <div className="shell">
          <div className="setup-box">
            <h2>Belum ada kelas</h2>
            <p className="muted">
              Admin dapat menambahkan kelas baru dari halaman Admin.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const attendanceMap = buildAttendanceMap(courseAttendance);
  const heldMeetingIds = getHeldMeetingIds(courseAttendance);
  const heldCount = heldMeetingIds.size;
  const totalPresent = courseAttendance.filter((x) => x.status === "H").length;
  const avgAttendance =
    heldCount && courseStudents.length
      ? Math.round((totalPresent / (heldCount * courseStudents.length)) * 100)
      : 0;

  const gradeMap = buildGradeMap(courseGrades);
  const totalWeight = courseAssessments.reduce(
    (sum, item) => sum + Number(item.weight),
    0,
  );

  function handleLecturerChange(lecturer: string) {
    setSelectedLecturer(lecturer);

    const firstCourse = courses.find((item) => item.lecturer === lecturer);
    setSelectedCourseId(firstCourse?.id ?? "");
  }

  return (
    <section className="page rekap-page">
      <div className="shell rekap-shell">
        <div className="hero rekap-hero">
          <div className="rekap-hero-copy">
            <div className="eyebrow">Sistem Akademik Kelas</div>
            <h1>Rekap Absensi & Nilai</h1>
            <p>
              Pilih kelas untuk melihat rekap kehadiran dan nilai yang sudah
              dipublikasikan oleh admin.
            </p>
          </div>

          <div className="public-course-filters rekap-filter-grid">
            <div className="course-picker rekap-course-picker">
              <label>Dosen Pengampu</label>
              <select
                className="select"
                value={selectedLecturer}
                onChange={(e) => handleLecturerChange(e.target.value)}
              >
                {lecturers.map((lecturer) => (
                  <option key={lecturer} value={lecturer}>
                    {lecturer}
                  </option>
                ))}
              </select>
            </div>

            <div className="course-picker rekap-course-picker">
              <label>Kelas / Mata Kuliah</label>
              <select
                className="select"
                value={course.id}
                onChange={(e) => setSelectedCourseId(e.target.value)}
              >
                {lecturerCourses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} — {item.class_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="info-grid rekap-info-grid">
          <div className="info-card">
            <small>Mata Kuliah</small>
            <strong>{course.name}</strong>
          </div>
          <div className="info-card">
            <small>Kelas</small>
            <strong>{course.class_name}</strong>
          </div>
          <div className="info-card">
            <small>Dosen Pengampu</small>
            <strong>{course.lecturer}</strong>
          </div>
          <div className="info-card">
            <small>Jadwal</small>
            <strong>{course.schedule || "—"}</strong>
          </div>
        </div>

        <div className="stat-grid rekap-stat-grid">
          <div className="stat-card">
            <div className="value">{courseStudents.length}</div>
            <div className="label">Mahasiswa</div>
          </div>
          <div className="stat-card">
            <div className="value">
              {heldCount}/{courseMeetings.length || course.meeting_count}
            </div>
            <div className="label">Pertemuan terlaksana</div>
          </div>
          <div className="stat-card">
            <div className="value">{avgAttendance}%</div>
            <div className="label">Rata-rata kehadiran</div>
          </div>
          <div className="stat-card highlight">
            <div className="value">{course.min_attendance_pct}%</div>
            <div className="label">Batas minimal kehadiran</div>
          </div>
        </div>

        <div className="rekap-print-wrap">
          <PrintAttendance
            course={course}
            students={students}
            meetings={meetings}
            attendance={attendance}
          />
        </div>

        <div className="tab-bar rekap-tabs">
          <button
            className={`tab-btn ${tab === "attendance" ? "active" : ""}`}
            onClick={() => setTab("attendance")}
          >
            Rekap Absensi
          </button>
          <button
            className={`tab-btn ${tab === "grades" ? "active" : ""}`}
            onClick={() => setTab("grades")}
          >
            Rekap Nilai
          </button>
        </div>

        {tab === "attendance" ? (
          <div className="panel rekap-panel">
            <div className="panel-head rekap-panel-head">
              <div>
                <h2>Rekap Absensi</h2>
                <p>H = Hadir, I = Izin, S = Sakit, A = Alfa.</p>
              </div>
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
                            <span className="badge neutral">Belum ada data</span>
                          ) : recap.percentage >= course.min_attendance_pct ? (
                            <span className="badge good">Memenuhi</span>
                          ) : (
                            <span className="badge warn">Belum memenuhi</span>
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
          <div className="panel rekap-panel">
            <div className="panel-head rekap-panel-head">
              <div>
                <h2>Rekap Nilai</h2>
                <p>
                  Nilai akhir dihitung berdasarkan bobot masing-masing komponen.
                </p>
              </div>

              {course.publish_grades && (
                <span
                  className={`badge ${totalWeight === 100 ? "good" : "warn"}`}
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
              <div className="panel-body muted">Belum ada komponen nilai.</div>
            ) : (
              <>
                <div className="rekap-mobile-hint" aria-hidden="true">
                  ← Geser tabel ke kanan/kiri untuk melihat seluruh komponen nilai
                  →
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
                            <span className="date">Bobot {item.weight}%</span>
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
      </div>

      <style jsx global>{`
        /* =========================================================
           REKAP DASHBOARD - RESPONSIVE
           Hanya memengaruhi komponen rekap ini.
           ========================================================= */

        .rekap-page,
        .rekap-shell {
          max-width: 100%;
        }

        .rekap-filter-grid {
          min-width: 0;
        }

        .rekap-course-picker,
        .rekap-course-picker .select {
          min-width: 0;
          max-width: 100%;
        }

        .rekap-info-grid,
        .rekap-stat-grid {
          min-width: 0;
        }

        .rekap-info-grid > *,
        .rekap-stat-grid > * {
          min-width: 0;
        }

        .rekap-info-grid strong {
          overflow-wrap: anywhere;
        }

        .rekap-tabs {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .rekap-tabs .tab-btn {
          flex: 0 0 auto;
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
          font-size: 10px;
          white-space: nowrap;
        }

        @media (max-width: 900px) {
          .rekap-hero {
            display: flex !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 18px !important;
          }

          .rekap-filter-grid {
            width: 100% !important;
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 12px !important;
          }

          .rekap-course-picker {
            width: 100% !important;
          }

          .rekap-course-picker .select {
            width: 100% !important;
          }

          .rekap-info-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .rekap-stat-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 640px) {
          .rekap-page {
            overflow-x: hidden;
          }

          .rekap-shell {
            width: 100% !important;
            max-width: 100% !important;
            padding-left: 12px !important;
            padding-right: 12px !important;
          }

          .rekap-hero {
            padding: 20px 16px !important;
          }

          .rekap-hero h1 {
            font-size: clamp(26px, 8vw, 36px) !important;
            line-height: 1.1 !important;
          }

          .rekap-hero p {
            font-size: 14px !important;
            line-height: 1.6 !important;
          }

          .rekap-filter-grid {
            grid-template-columns: 1fr !important;
          }

          .rekap-info-grid {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }

          .rekap-stat-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 10px !important;
          }

          .rekap-stat-grid .stat-card {
            padding: 14px 10px !important;
          }

          .rekap-stat-grid .value {
            font-size: 24px !important;
          }

          .rekap-print-wrap {
            max-width: 100%;
            overflow-x: auto;
          }

          .rekap-tabs {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            width: 100% !important;
            gap: 8px !important;
          }

          .rekap-tabs .tab-btn {
            width: 100% !important;
            min-width: 0 !important;
            padding-left: 10px !important;
            padding-right: 10px !important;
          }

          .rekap-panel {
            min-width: 0 !important;
            overflow: hidden;
          }

          .rekap-panel-head {
            padding: 18px 16px !important;
          }

          .rekap-panel-head h2 {
            font-size: 20px !important;
          }

          .rekap-panel-head p {
            font-size: 13px !important;
          }

          .rekap-mobile-hint {
            display: block;
            margin: 12px 12px 8px;
            padding: 9px 10px;
            border-radius: 10px;
            background: #eff6ff;
            color: #1d4ed8;
            font-size: 11px;
            font-weight: 700;
            line-height: 1.4;
            text-align: center;
          }

          .rekap-table-scroll {
            border-radius: 0 0 14px 14px;
          }

          .rekap-table {
            width: max-content !important;
            min-width: max-content !important;
          }

          .rekap-table th,
          .rekap-table td {
            padding: 10px 8px !important;
            font-size: 12px !important;
          }

          /*
             Sticky kolom bagus di desktop, tetapi di HP No + NPM + Nama
             menghabiskan hampir seluruh layar. Di HP semuanya dibuat normal
             agar pengguna benar-benar bisa swipe ke P1-P16.
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
            min-width: 44px !important;
            width: 44px !important;
            text-align: center !important;
          }

          .rekap-table .sticky-npm {
            min-width: 98px !important;
            width: 98px !important;
          }

          .rekap-table .sticky-name {
            min-width: 180px !important;
            width: 180px !important;
            max-width: 180px !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }

          .rekap-table .meeting-col,
          .rekap-table tbody td:not(.sticky-no):not(.sticky-npm):not(.sticky-name) {
            min-width: 54px;
            text-align: center;
          }

          .rekap-grade-table th:not(.sticky-no):not(.sticky-npm):not(.sticky-name),
          .rekap-grade-table td:not(.sticky-no):not(.sticky-npm):not(.sticky-name) {
            min-width: 92px;
            text-align: center;
          }

          .rekap-table .badge {
            white-space: nowrap;
          }
        }

        @media (max-width: 380px) {
          .rekap-shell {
            padding-left: 8px !important;
            padding-right: 8px !important;
          }

          .rekap-stat-grid {
            grid-template-columns: 1fr !important;
          }

          .rekap-tabs {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </section>
  );
}
