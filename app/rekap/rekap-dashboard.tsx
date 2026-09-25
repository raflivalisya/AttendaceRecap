"use client";

import { buildAttendanceMap, formatShortDate, getHeldMeetingIds, getStudentRecap } from "@/lib/attendance";
import { buildGradeMap, calculateFinalScore } from "@/lib/grades";
import type { Assessment, Attendance, Course, Grade, Meeting, Student } from "@/lib/types";
import { useMemo, useState } from "react";

type Props = {
  courses: Course[];
  students: Student[];
  meetings: Meeting[];
  attendance: Attendance[];
  assessments: Assessment[];
  grades: Grade[];
};

export default function RekapDashboard({ courses, students, meetings, attendance, assessments, grades }: Props) {
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id ?? "");
  const [tab, setTab] = useState<"attendance" | "grades">("attendance");

  const course = courses.find((item) => item.id === selectedCourseId) ?? courses[0];
  const courseStudents = useMemo(() => students.filter((item) => item.course_id === course?.id), [students, course?.id]);
  const courseMeetings = useMemo(() => meetings.filter((item) => item.course_id === course?.id).sort((a, b) => a.meeting_no - b.meeting_no), [meetings, course?.id]);
  const meetingIds = useMemo(() => new Set(courseMeetings.map((item) => item.id)), [courseMeetings]);
  const courseAttendance = useMemo(() => attendance.filter((item) => meetingIds.has(item.meeting_id)), [attendance, meetingIds]);
  const courseAssessments = useMemo(() => assessments.filter((item) => item.course_id === course?.id).sort((a, b) => a.sort_order - b.sort_order), [assessments, course?.id]);
  const assessmentIds = useMemo(() => new Set(courseAssessments.map((item) => item.id)), [courseAssessments]);
  const courseGrades = useMemo(() => grades.filter((item) => assessmentIds.has(item.assessment_id)), [grades, assessmentIds]);

  if (!course) {
    return <section className="page"><div className="shell"><div className="setup-box"><h2>Belum ada kelas</h2><p className="muted">Admin dapat menambahkan kelas baru dari halaman Admin.</p></div></div></section>;
  }

  const attendanceMap = buildAttendanceMap(courseAttendance);
  const heldMeetingIds = getHeldMeetingIds(courseAttendance);
  const heldCount = heldMeetingIds.size;
  const totalPresent = courseAttendance.filter((x) => x.status === "H").length;
  const avgAttendance = heldCount && courseStudents.length ? Math.round((totalPresent / (heldCount * courseStudents.length)) * 100) : 0;
  const gradeMap = buildGradeMap(courseGrades);
  const totalWeight = courseAssessments.reduce((sum, item) => sum + Number(item.weight), 0);

  return (
    <section className="page">
      <div className="shell">
        <div className="hero">
          <div>
            <div className="eyebrow">Sistem Akademik Kelas</div>
            <h1>Rekap Absensi & Nilai</h1>
            <p>Pilih kelas untuk melihat rekap kehadiran dan nilai yang sudah dipublikasikan oleh admin.</p>
          </div>
          <div className="course-picker">
            <label>Kelas / Mata Kuliah</label>
            <select className="select" value={course.id} onChange={(e) => setSelectedCourseId(e.target.value)}>
              {courses.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.class_name}</option>)}
            </select>
          </div>
        </div>

        <div className="info-grid">
          <div className="info-card"><small>Mata Kuliah</small><strong>{course.name}</strong></div>
          <div className="info-card"><small>Kelas</small><strong>{course.class_name}</strong></div>
          <div className="info-card"><small>Dosen Pengampu</small><strong>{course.lecturer}</strong></div>
          <div className="info-card"><small>Jadwal</small><strong>{course.schedule || "—"}</strong></div>
        </div>

        <div className="stat-grid">
          <div className="stat-card"><div className="value">{courseStudents.length}</div><div className="label">Mahasiswa</div></div>
          <div className="stat-card"><div className="value">{heldCount}/{courseMeetings.length || course.meeting_count}</div><div className="label">Pertemuan terlaksana</div></div>
          <div className="stat-card"><div className="value">{avgAttendance}%</div><div className="label">Rata-rata kehadiran</div></div>
          <div className="stat-card highlight"><div className="value">{course.min_attendance_pct}%</div><div className="label">Batas minimal kehadiran</div></div>
        </div>

        <div className="tab-bar">
          <button className={`tab-btn ${tab === "attendance" ? "active" : ""}`} onClick={() => setTab("attendance")}>Rekap Absensi</button>
          <button className={`tab-btn ${tab === "grades" ? "active" : ""}`} onClick={() => setTab("grades")}>Rekap Nilai</button>
        </div>

        {tab === "attendance" ? (
          <div className="panel">
            <div className="panel-head">
              <div><h2>Rekap Absensi</h2><p>H = Hadir, I = Izin, S = Sakit, A = Alfa.</p></div>
            </div>
            <div className="table-wrap">
              <table className="attendance-table">
                <thead><tr>
                  <th className="sticky-no">No</th><th className="sticky-npm">NPM</th><th className="sticky-name">Nama Mahasiswa</th>
                  {courseMeetings.map((meeting) => <th className="meeting-col" key={meeting.id}>{meeting.meeting_no}<span className="date">{formatShortDate(meeting.meeting_date)}</span></th>)}
                  <th>H</th><th>I</th><th>S</th><th>A</th><th>% Hadir</th><th>Status</th>
                </tr></thead>
                <tbody>
                  {courseStudents.map((student, index) => {
                    const recap = getStudentRecap(student, courseMeetings, attendanceMap, heldMeetingIds);
                    return <tr key={student.id}>
                      <td className="sticky-no">{index + 1}</td><td className="sticky-npm">{student.npm}</td><td className="sticky-name"><strong>{student.name}</strong></td>
                      {courseMeetings.map((meeting) => {
                        const status = attendanceMap.get(`${meeting.id}:${student.id}`);
                        return <td key={meeting.id}>{status ? <span className={`status-dot status-${status}`}>{status}</span> : <span className="status-empty">–</span>}</td>;
                      })}
                      <td>{recap.H}</td><td>{recap.I}</td><td>{recap.S}</td><td>{recap.A}</td><td><strong>{recap.percentage}%</strong></td>
                      <td>{recap.held === 0 ? <span className="badge neutral">Belum ada data</span> : recap.percentage >= course.min_attendance_pct ? <span className="badge good">Memenuhi</span> : <span className="badge warn">Belum memenuhi</span>}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="panel">
            <div className="panel-head">
              <div><h2>Rekap Nilai</h2><p>Nilai akhir dihitung berdasarkan bobot masing-masing komponen.</p></div>
              {course.publish_grades && <span className={`badge ${totalWeight === 100 ? "good" : "warn"}`}>Total bobot {totalWeight}%</span>}
            </div>
            {!course.publish_grades ? (
              <div className="panel-body"><div className="privacy-note"><strong>Nilai belum dipublikasikan.</strong><span>Admin masih menyimpan rekap nilai sebagai data internal.</span></div></div>
            ) : courseAssessments.length === 0 ? (
              <div className="panel-body muted">Belum ada komponen nilai.</div>
            ) : (
              <div className="table-wrap">
                <table className="attendance-table grade-table">
                  <thead><tr><th className="sticky-no">No</th><th className="sticky-npm">NPM</th><th className="sticky-name">Nama Mahasiswa</th>
                    {courseAssessments.map((item) => <th key={item.id}>{item.name}<span className="date">Bobot {item.weight}%</span></th>)}
                    <th>Nilai Akhir</th><th>Kelengkapan</th>
                  </tr></thead>
                  <tbody>{courseStudents.map((student, index) => {
                    const final = calculateFinalScore(student.id, courseAssessments, gradeMap);
                    return <tr key={student.id}><td className="sticky-no">{index + 1}</td><td className="sticky-npm">{student.npm}</td><td className="sticky-name"><strong>{student.name}</strong></td>
                      {courseAssessments.map((item) => {
                        const score = gradeMap.get(`${item.id}:${student.id}`);
                        return <td key={item.id}>{score === undefined ? "–" : score}</td>;
                      })}
                      <td><strong>{final.score.toFixed(2)}</strong></td><td><span className={`badge ${final.completed === final.total ? "good" : "neutral"}`}>{final.completed}/{final.total}</span></td>
                    </tr>;
                  })}</tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
