"use client";

import { STATUS_LABELS, formatLongDate } from "@/lib/attendance";
import { buildGradeMap, calculateFinalScore } from "@/lib/grades";
import { createClient } from "@/lib/supabase/client";
import type { Assessment, Attendance, AttendanceStatus, Course, Grade, Meeting, Student } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import ImportStudentsTxt from "@/components/admin/ImportStudentsTxt";
import CourseByLecturer from "@/components/admin/CourseByLecturer";
import AttendanceQR from "@/components/admin/AttendanceQR";



type Props = {
  initialCourses: Course[];
  initialStudents: Student[];
  initialMeetings: Meeting[];
  initialAttendance: Attendance[];
  initialAssessments: Assessment[];
  initialGrades: Grade[];
  adminEmail: string;
};

type Tab = "attendance" | "grades" | "students" | "settings";
type StatusValue = AttendanceStatus | "";

type NewCourseForm = {
  name: string; class_name: string; lecturer: string; schedule: string; semester: string;
  academic_year: string; meeting_count: number; min_attendance_pct: number; start_date: string;
};

const emptyCourse: NewCourseForm = {
  name: "", class_name: "", lecturer: "", schedule: "", semester: "Ganjil",
  academic_year: "2026/2027", meeting_count: 16, min_attendance_pct: 80, start_date: "",
};

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export default function AdminPanel(props: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [courses, setCourses] = useState(props.initialCourses);
  const [students, setStudents] = useState(props.initialStudents);
  const [meetings, setMeetings] = useState(props.initialMeetings);
  const [attendance, setAttendance] = useState(props.initialAttendance);
  const [assessments, setAssessments] = useState(props.initialAssessments);
  const [grades, setGrades] = useState(props.initialGrades);
  const [selectedCourseId, setSelectedCourseId] = useState(props.initialCourses[0]?.id ?? "");
  const [tab, setTab] = useState<Tab>("attendance");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAddCourse, setShowAddCourse] = useState(props.initialCourses.length === 0);
  const [newCourse, setNewCourse] = useState<NewCourseForm>(emptyCourse);
  const [newNpm, setNewNpm] = useState("");
  const [newName, setNewName] = useState("");
  const [newAssessment, setNewAssessment] = useState({ name: "", category: "Tugas", max_score: 100, weight: 10 });

  const selectedCourse = courses.find((item) => item.id === selectedCourseId);
  const courseStudents = useMemo(() => students.filter((item) => item.course_id === selectedCourseId).sort((a, b) => a.npm.localeCompare(b.npm)), [students, selectedCourseId]);
  const courseMeetings = useMemo(() => meetings.filter((item) => item.course_id === selectedCourseId).sort((a, b) => a.meeting_no - b.meeting_no), [meetings, selectedCourseId]);
  const courseAssessments = useMemo(() => assessments.filter((item) => item.course_id === selectedCourseId).sort((a, b) => a.sort_order - b.sort_order), [assessments, selectedCourseId]);
  const courseMeetingIds = useMemo(() => new Set(courseMeetings.map((m) => m.id)), [courseMeetings]);
  const courseAssessmentIds = useMemo(() => new Set(courseAssessments.map((a) => a.id)), [courseAssessments]);
  const courseAttendance = useMemo(() => attendance.filter((item) => courseMeetingIds.has(item.meeting_id)), [attendance, courseMeetingIds]);
  const courseGrades = useMemo(() => grades.filter((item) => courseAssessmentIds.has(item.assessment_id)), [grades, courseAssessmentIds]);

  const [selectedMeetingId, setSelectedMeetingId] = useState(() => {
    const courseId = props.initialCourses[0]?.id;
    return props.initialMeetings.find((item) => item.course_id === courseId)?.id ?? "";
  });
  const [attendanceDraft, setAttendanceDraft] = useState<Record<string, StatusValue>>(() => {
    const courseId = props.initialCourses[0]?.id;
    const meetingId = props.initialMeetings.find((item) => item.course_id === courseId)?.id;
    const map: Record<string, StatusValue> = {};
    props.initialStudents.filter((s) => s.course_id === courseId).forEach((student) => {
      map[student.id] = props.initialAttendance.find((a) => a.meeting_id === meetingId && a.student_id === student.id)?.status ?? "";
    });
    return map;
  });
  const [gradeDraft, setGradeDraft] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    props.initialGrades.forEach((g) => { map[`${g.assessment_id}:${g.student_id}`] = String(g.score); });
    return map;
  });
  const [courseDraft, setCourseDraft] = useState<Partial<Course>>(props.initialCourses[0] ?? {});

  const selectedMeeting = courseMeetings.find((m) => m.id === selectedMeetingId);
  const gradeMap = buildGradeMap(courseGrades);
  const totalWeight = courseAssessments.reduce((sum, item) => sum + Number(item.weight), 0);

  function notify(text: string) { setMessage(text); window.scrollTo({ top: 0, behavior: "smooth" }); }

  function chooseCourse(courseId: string) {
    const nextCourse = courses.find((item) => item.id === courseId);
    const nextMeetings = meetings.filter((item) => item.course_id === courseId).sort((a, b) => a.meeting_no - b.meeting_no);
    const nextStudents = students.filter((item) => item.course_id === courseId);
    const meetingId = nextMeetings[0]?.id ?? "";
    const map: Record<string, StatusValue> = {};
    nextStudents.forEach((student) => {
      map[student.id] = attendance.find((a) => a.meeting_id === meetingId && a.student_id === student.id)?.status ?? "";
    });
    setSelectedCourseId(courseId); setSelectedMeetingId(meetingId); setAttendanceDraft(map);
    setCourseDraft(nextCourse ?? {}); setMessage(""); setTab("attendance");
  }

  function loadMeeting(meetingId: string) {
    const map: Record<string, StatusValue> = {};
    courseStudents.forEach((student) => {
      map[student.id] = attendance.find((a) => a.meeting_id === meetingId && a.student_id === student.id)?.status ?? "";
    });
    setSelectedMeetingId(meetingId); setAttendanceDraft(map); setMessage("");
  }

  async function createCourse() {
    if (!newCourse.name.trim() || !newCourse.class_name.trim() || !newCourse.lecturer.trim() || !newCourse.start_date) {
      notify("Lengkapi mata kuliah, kelas, dosen, dan tanggal pertemuan pertama."); return;
    }
    setSaving(true); setMessage("");
    const { data: created, error } = await supabase.from("courses").insert({
      name: newCourse.name.trim(), class_name: newCourse.class_name.trim(), lecturer: newCourse.lecturer.trim(),
      schedule: newCourse.schedule.trim(), semester: newCourse.semester.trim(), academic_year: newCourse.academic_year.trim(),
      meeting_count: Number(newCourse.meeting_count), min_attendance_pct: Number(newCourse.min_attendance_pct), publish_grades: false,
    }).select("*").single();
    if (error || !created) { notify(`Gagal menambah kelas: ${error?.message ?? "Unknown error"}`); setSaving(false); return; }

    const course = created as Course;
    const meetingRows = Array.from({ length: course.meeting_count }, (_, i) => ({ course_id: course.id, meeting_no: i + 1, meeting_date: addDays(newCourse.start_date, i * 7) }));
    const defaultAssessments = [
      { course_id: course.id, name: "Tugas", category: "Tugas", max_score: 100, weight: 25, sort_order: 1 },
      { course_id: course.id, name: "Quiz", category: "Quiz", max_score: 100, weight: 15, sort_order: 2 },
      { course_id: course.id, name: "UTS", category: "UTS", max_score: 100, weight: 25, sort_order: 3 },
      { course_id: course.id, name: "UAS", category: "UAS", max_score: 100, weight: 35, sort_order: 4 },
    ];
    const [{ data: createdMeetings, error: meetingError }, { data: createdAssessments, error: assessmentError }] = await Promise.all([
      supabase.from("meetings").insert(meetingRows).select("*"),
      supabase.from("assessments").insert(defaultAssessments).select("*"),
    ]);
    if (meetingError || assessmentError) {
      notify(`Kelas dibuat, tetapi data awal belum lengkap: ${meetingError?.message ?? assessmentError?.message}`);
    } else {
      notify("Kelas baru berhasil dibuat beserta jadwal dan komponen nilai default.");
    }
    setCourses((items) => [...items, course]);
    setMeetings((items) => [...items, ...((createdMeetings ?? []) as Meeting[])]);
    setAssessments((items) => [...items, ...((createdAssessments ?? []) as Assessment[])]);
    setNewCourse(emptyCourse); setShowAddCourse(false); setSaving(false);
    setSelectedCourseId(course.id); setCourseDraft(course); setTab("attendance");
    const firstMeeting = (createdMeetings?.[0] as Meeting | undefined)?.id ?? ""; setSelectedMeetingId(firstMeeting); setAttendanceDraft({});
  }

  async function saveAttendance() {
    if (!selectedMeetingId) return;
    setSaving(true); setMessage("");
    const filled = courseStudents.filter((s) => attendanceDraft[s.id]).map((s) => ({ meeting_id: selectedMeetingId, student_id: s.id, status: attendanceDraft[s.id] as AttendanceStatus }));
    const existingBlankIds = courseStudents.filter((s) => !attendanceDraft[s.id]).map((s) => attendance.find((a) => a.meeting_id === selectedMeetingId && a.student_id === s.id)?.id).filter(Boolean) as string[];
    if (filled.length) {
      const { error } = await supabase.from("attendance").upsert(filled, { onConflict: "meeting_id,student_id" });
      if (error) { notify(`Gagal menyimpan absensi: ${error.message}`); setSaving(false); return; }
    }
    if (existingBlankIds.length) await supabase.from("attendance").delete().in("id", existingBlankIds);
    const { data } = await supabase.from("attendance").select("*"); setAttendance((data ?? []) as Attendance[]);
    notify("Absensi berhasil disimpan."); setSaving(false);
  }

  async function updateMeetingDate(date: string) {
    if (!selectedMeetingId) return;
    const { error } = await supabase.from("meetings").update({ meeting_date: date }).eq("id", selectedMeetingId);
    if (error) { notify(`Gagal mengubah tanggal: ${error.message}`); return; }
    setMeetings((items) => items.map((item) => item.id === selectedMeetingId ? { ...item, meeting_date: date } : item));
    notify("Tanggal pertemuan diperbarui.");
  }

async function refreshStudents() {
  const { data, error } = await supabase
    .from("students")
    .select("*");

  if (error) {
    notify(`Gagal memuat mahasiswa: ${error.message}`);
    return;
  }

  setStudents((data ?? []) as Student[]);
}

  async function addStudent() {
    if (!selectedCourse || !newNpm.trim() || !newName.trim()) return;
    const { data, error } = await supabase.from("students").insert({ course_id: selectedCourse.id, npm: newNpm.trim(), name: newName.trim().toUpperCase() }).select("*").single();
    if (error || !data) { notify(`Gagal menambah mahasiswa: ${error?.message}`); return; }
    const student = data as Student; setStudents((items) => [...items, student]); setAttendanceDraft((d) => ({ ...d, [student.id]: "" }));
    setNewNpm(""); setNewName(""); notify("Mahasiswa berhasil ditambahkan.");
  }

  async function renameStudent(student: Student) {
    const nextName = window.prompt("Nama mahasiswa:", student.name)?.trim(); if (!nextName || nextName === student.name) return;
    const { error } = await supabase.from("students").update({ name: nextName.toUpperCase() }).eq("id", student.id);
    if (error) { notify(`Gagal mengubah nama: ${error.message}`); return; }
    setStudents((items) => items.map((x) => x.id === student.id ? { ...x, name: nextName.toUpperCase() } : x)); notify("Nama diperbarui.");
  }

  async function deleteStudent(student: Student) {
    if (!window.confirm(`Hapus ${student.name} beserta absensi dan nilainya?`)) return;
    const { error } = await supabase.from("students").delete().eq("id", student.id); if (error) { notify(`Gagal menghapus: ${error.message}`); return; }
    setStudents((items) => items.filter((x) => x.id !== student.id)); setAttendance((items) => items.filter((x) => x.student_id !== student.id)); setGrades((items) => items.filter((x) => x.student_id !== student.id)); notify("Mahasiswa dihapus.");
  }

  async function addAssessment() {
    if (!selectedCourse || !newAssessment.name.trim()) return;
    const sortOrder = (courseAssessments.at(-1)?.sort_order ?? 0) + 1;
    const { data, error } = await supabase.from("assessments").insert({ course_id: selectedCourse.id, name: newAssessment.name.trim(), category: newAssessment.category.trim() || "Lainnya", max_score: Number(newAssessment.max_score), weight: Number(newAssessment.weight), sort_order: sortOrder }).select("*").single();
    if (error || !data) { notify(`Gagal menambah komponen nilai: ${error?.message}`); return; }
    setAssessments((items) => [...items, data as Assessment]); setNewAssessment({ name: "", category: "Tugas", max_score: 100, weight: 10 }); notify("Komponen nilai ditambahkan.");
  }

  async function editAssessment(item: Assessment) {
    const name = window.prompt("Nama komponen:", item.name)?.trim(); if (!name) return;
    const weightRaw = window.prompt("Bobot (%):", String(item.weight)); if (weightRaw === null) return;
    const maxRaw = window.prompt("Nilai maksimum:", String(item.max_score)); if (maxRaw === null) return;
    const weight = Number(weightRaw); const max_score = Number(maxRaw);
    if (!Number.isFinite(weight) || !Number.isFinite(max_score) || weight < 0 || weight > 100 || max_score <= 0) { notify("Bobot atau nilai maksimum tidak valid."); return; }
    const { error } = await supabase.from("assessments").update({ name, weight, max_score }).eq("id", item.id); if (error) { notify(`Gagal mengubah: ${error.message}`); return; }
    setAssessments((items) => items.map((x) => x.id === item.id ? { ...x, name, weight, max_score } : x)); notify("Komponen nilai diperbarui.");
  }

  async function deleteAssessment(item: Assessment) {
    if (!window.confirm(`Hapus komponen ${item.name} beserta semua nilainya?`)) return;
    const { error } = await supabase.from("assessments").delete().eq("id", item.id); if (error) { notify(`Gagal menghapus: ${error.message}`); return; }
    setAssessments((items) => items.filter((x) => x.id !== item.id)); setGrades((items) => items.filter((x) => x.assessment_id !== item.id)); notify("Komponen nilai dihapus.");
  }

  async function saveGrades() {
    setSaving(true); setMessage("");
    const filled: { assessment_id: string; student_id: string; score: number }[] = [];
    const deleteIds: string[] = [];
    for (const assessment of courseAssessments) {
      for (const student of courseStudents) {
        const key = `${assessment.id}:${student.id}`; const raw = gradeDraft[key]?.trim() ?? "";
        if (raw === "") {
          const existing = grades.find((g) => g.assessment_id === assessment.id && g.student_id === student.id); if (existing) deleteIds.push(existing.id); continue;
        }
        const score = Number(raw);
        if (!Number.isFinite(score) || score < 0 || score > Number(assessment.max_score)) { notify(`Nilai ${student.name} untuk ${assessment.name} harus 0–${assessment.max_score}.`); setSaving(false); return; }
        filled.push({ assessment_id: assessment.id, student_id: student.id, score });
      }
    }
    if (filled.length) {
      const { error } = await supabase.from("grades").upsert(filled, { onConflict: "assessment_id,student_id" }); if (error) { notify(`Gagal menyimpan nilai: ${error.message}`); setSaving(false); return; }
    }
    if (deleteIds.length) await supabase.from("grades").delete().in("id", deleteIds);
    const { data } = await supabase.from("grades").select("*"); setGrades((data ?? []) as Grade[]); notify("Nilai berhasil disimpan."); setSaving(false);
  }

  async function saveCourseSettings() {
    if (!selectedCourse) return;
    const payload = {
      name: String(courseDraft.name ?? "").trim(), class_name: String(courseDraft.class_name ?? "").trim(), lecturer: String(courseDraft.lecturer ?? "").trim(),
      schedule: String(courseDraft.schedule ?? "").trim(), semester: String(courseDraft.semester ?? "").trim(), academic_year: String(courseDraft.academic_year ?? "").trim(),
      min_attendance_pct: Number(courseDraft.min_attendance_pct ?? 80), publish_grades: Boolean(courseDraft.publish_grades),
    };
    if (!payload.name || !payload.class_name || !payload.lecturer) { notify("Mata kuliah, kelas, dan dosen wajib diisi."); return; }
    const { error } = await supabase.from("courses").update(payload).eq("id", selectedCourse.id); if (error) { notify(`Gagal menyimpan pengaturan: ${error.message}`); return; }
    setCourses((items) => items.map((x) => x.id === selectedCourse.id ? { ...x, ...payload } : x)); notify("Pengaturan kelas disimpan.");
  }

  async function deleteCourse() {
    if (!selectedCourse || !window.confirm(`Hapus kelas ${selectedCourse.name} — ${selectedCourse.class_name} beserta seluruh datanya?`)) return;
    const { error } = await supabase.from("courses").delete().eq("id", selectedCourse.id); if (error) { notify(`Gagal menghapus kelas: ${error.message}`); return; }
    const remaining = courses.filter((x) => x.id !== selectedCourse.id); setCourses(remaining); setStudents((x) => x.filter((s) => s.course_id !== selectedCourse.id)); setMeetings((x) => x.filter((m) => m.course_id !== selectedCourse.id)); setAssessments((x) => x.filter((a) => a.course_id !== selectedCourse.id));
    if (remaining[0]) chooseCourse(remaining[0].id); else { setSelectedCourseId(""); setCourseDraft({}); setShowAddCourse(true); }
    notify("Kelas berhasil dihapus.");
  }

async function refreshAttendance() {
  const { data, error } =
    await supabase
      .from("attendance")
      .select("*");

  if (error) {
    notify(
      `Gagal memuat absensi: ${error.message}`
    );

    return;
  }

  const rows =
    (data ?? []) as Attendance[];

  setAttendance(rows);

  const map:
    Record<
      string,
      StatusValue
    > = {};

  courseStudents.forEach(
    (student) => {
      map[student.id] =
        rows.find(
          (item) =>
            item.meeting_id ===
              selectedMeetingId &&
            item.student_id ===
              student.id
        )?.status ?? "";
    }
  );

  setAttendanceDraft(map);

  notify(
    "Data absensi QR diperbarui."
  );
}

  async function logout() { await supabase.auth.signOut(); router.refresh(); }

  return <section className="page"><div className="shell">
    <div className="hero"><div><div className="eyebrow">Panel Administrator</div><h1>Kelola Kelas, Absensi & Nilai</h1><p>Tambahkan mata kuliah apa pun, kelola mahasiswa, presensi, dan komponen penilaian dari satu tempat.</p></div><div className="admin-actions"><span className="badge neutral">{props.adminEmail}</span><button className="btn btn-secondary" onClick={logout}>Keluar</button></div></div>
    {message && <div className={message.toLowerCase().includes("gagal") || message.toLowerCase().includes("harus") || message.toLowerCase().includes("lengkapi") ? "error" : "success"} style={{ marginBottom: 14 }}>{message}</div>}

    <div className="course-admin-layout">
      <aside className="panel course-sidebar"><div className="panel-head"><div><h2>Daftar Kelas</h2><p>{courses.length} kelas dikelola</p></div><button className="icon-btn" onClick={() => setShowAddCourse((v) => !v)}>＋</button></div>
        <div className="panel-body course-list">{courses.map((course) => <button key={course.id} className={`course-btn ${selectedCourseId === course.id ? "active" : ""}`} onClick={() => chooseCourse(course.id)}><strong>{course.name}</strong><span>{course.class_name} · {course.lecturer}</span></button>)}{courses.length === 0 && <p className="muted">Belum ada kelas.</p>}</div>
      </aside>

      <div className="admin-main">
        {showAddCourse && <section className="panel add-course-panel"><div className="panel-head"><div><h2>Tambah Kelas / Mata Kuliah</h2><p>Jadwal pertemuan akan dibuat otomatis mingguan dari tanggal pertama.</p></div></div><div className="panel-body form-grid-3">
          <div className="field"><label>Mata Kuliah *</label><input className="input" value={newCourse.name} onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })} placeholder="Algoritma & Struktur Data" /></div>
          <div className="field"><label>Kelas *</label><input className="input" value={newCourse.class_name} onChange={(e) => setNewCourse({ ...newCourse, class_name: e.target.value })} placeholder="IF 25 A" /></div>
          <div className="field"><label>Dosen Pengampu *</label><input className="input" value={newCourse.lecturer} onChange={(e) => setNewCourse({ ...newCourse, lecturer: e.target.value })} placeholder="Nama Dosen, M.Kom." /></div>
          <div className="field"><label>Jadwal</label><input className="input" value={newCourse.schedule} onChange={(e) => setNewCourse({ ...newCourse, schedule: e.target.value })} placeholder="Kamis, 10:00–11:40" /></div>
          <div className="field"><label>Semester</label><input className="input" value={newCourse.semester} onChange={(e) => setNewCourse({ ...newCourse, semester: e.target.value })} /></div>
          <div className="field"><label>Tahun Akademik</label><input className="input" value={newCourse.academic_year} onChange={(e) => setNewCourse({ ...newCourse, academic_year: e.target.value })} /></div>
          <div className="field"><label>Jumlah Pertemuan</label><input className="input" type="number" min="1" max="40" value={newCourse.meeting_count} onChange={(e) => setNewCourse({ ...newCourse, meeting_count: Number(e.target.value) })} /></div>
          <div className="field"><label>Batas Kehadiran (%)</label><input className="input" type="number" min="0" max="100" value={newCourse.min_attendance_pct} onChange={(e) => setNewCourse({ ...newCourse, min_attendance_pct: Number(e.target.value) })} /></div>
          <div className="field"><label>Tanggal Pertemuan 1 *</label><input className="input" type="date" value={newCourse.start_date} onChange={(e) => setNewCourse({ ...newCourse, start_date: e.target.value })} /></div>
          <div className="form-actions-full"><button className="btn btn-primary" disabled={saving} onClick={createCourse}>{saving ? "Membuat..." : "Buat Kelas"}</button><button className="btn btn-secondary" onClick={() => setShowAddCourse(false)}>Batal</button></div>
        </div></section>}

        {selectedCourse ? <>
          <div className="selected-course-head"><div><span className="eyebrow">Kelas Aktif</span><h2>{selectedCourse.name} <span>· {selectedCourse.class_name}</span></h2><p>{selectedCourse.lecturer} · {selectedCourse.schedule || "Jadwal belum diisi"}</p></div><span className="badge neutral">{selectedCourse.semester} {selectedCourse.academic_year}</span></div>
          <div className="tab-bar admin-tabs"><button className={`tab-btn ${tab === "attendance" ? "active" : ""}`} onClick={() => setTab("attendance")}>Absensi</button><button className={`tab-btn ${tab === "grades" ? "active" : ""}`} onClick={() => setTab("grades")}>Nilai</button><button className={`tab-btn ${tab === "students" ? "active" : ""}`} onClick={() => setTab("students")}>Mahasiswa</button><button className={`tab-btn ${tab === "settings" ? "active" : ""}`} onClick={() => setTab("settings")}>Pengaturan</button></div>
  <CourseByLecturer
    courses={courses}
    selectedCourseId={selectedCourseId}
    onSelect={(courseId) => {
      chooseCourse(courseId);
    }}
  />
          {tab === "attendance" && <div className="admin-grid"><aside className="panel admin-side"><div className="panel-head"><div><h2>Pertemuan</h2><p>{courseMeetings.length} pertemuan</p></div></div><div className="panel-body"><div className="meeting-list">{courseMeetings.map((meeting) => <button key={meeting.id} className={`meeting-btn ${selectedMeetingId === meeting.id ? "active" : ""}`} onClick={() => loadMeeting(meeting.id)}><span><strong>P{meeting.meeting_no}</strong><br/><small>{meeting.meeting_date}</small></span><span>›</span></button>)}</div></div></aside>
            <section className="panel"><div className="panel-head"><div><h2>Input Absensi {selectedMeeting ? `Pertemuan ${selectedMeeting.meeting_no}` : ""}</h2><p>{selectedMeeting ? formatLongDate(selectedMeeting.meeting_date) : "Pilih pertemuan"}</p></div></div><div className="panel-body"><div className="admin-toolbar"><div className="field"><label>Tanggal Pertemuan</label><input className="input" type="date" value={selectedMeeting?.meeting_date ?? ""} onChange={(e) => updateMeetingDate(e.target.value)} /></div><div className="admin-actions"><button className="btn btn-success" onClick={() => { const x: Record<string, StatusValue> = {}; courseStudents.forEach((s) => x[s.id] = "H"); setAttendanceDraft(x); }}>Semua Hadir</button>
            <button
  className="btn btn-secondary"
  onClick={refreshAttendance}
>
  ↻ Refresh QR
</button>
            <button className="btn btn-secondary" onClick={() => { const x: Record<string, StatusValue> = {}; courseStudents.forEach((s) => x[s.id] = ""); setAttendanceDraft(x); }}>Kosongkan</button><button className="btn btn-primary" onClick={saveAttendance} disabled={saving || !selectedMeetingId}>{saving ? "Menyimpan..." : "Simpan Absensi"}</button></div></div>
              {selectedMeeting && selectedCourse && (
  <AttendanceQR
    meetingId={selectedMeeting.id}
    meetingNo={selectedMeeting.meeting_no}
    courseName={selectedCourse.name}
    classLabel={selectedCourse.class_name}
  />
)}
              <div className="table-wrap"><table className="admin-table"><thead><tr><th>No</th><th>NPM</th><th>Nama Mahasiswa</th><th>Status</th></tr></thead><tbody>{courseStudents.map((student, index) => <tr key={student.id}><td>{index + 1}</td><td>{student.npm}</td><td><strong>{student.name}</strong></td><td><select className="status-select" value={attendanceDraft[student.id] ?? ""} onChange={(e) => setAttendanceDraft((d) => ({ ...d, [student.id]: e.target.value as StatusValue }))}><option value="">— Belum diisi —</option>{(Object.keys(STATUS_LABELS) as AttendanceStatus[]).map((key) => <option key={key} value={key}>{key} — {STATUS_LABELS[key]}</option>)}</select></td></tr>)}</tbody></table>{courseStudents.length === 0 && <div className="empty-state">Tambahkan mahasiswa terlebih dahulu pada tab Mahasiswa.</div>}</div>
            </div></section></div>}

          {tab === "grades" && <section className="panel"><div className="panel-head"><div><h2>Input Nilai</h2><p>Isi nilai mentah. Nilai akhir dihitung otomatis berdasarkan bobot.</p></div><span className={`badge ${totalWeight === 100 ? "good" : "warn"}`}>Total bobot {totalWeight}%</span></div><div className="panel-body">
            <div className="assessment-manager"><div className="inline-form"><div className="field"><label>Nama Komponen</label><input className="input" value={newAssessment.name} onChange={(e) => setNewAssessment({ ...newAssessment, name: e.target.value })} placeholder="Tugas 2" /></div><div className="field small-field"><label>Kategori</label><select className="select" value={newAssessment.category} onChange={(e) => setNewAssessment({ ...newAssessment, category: e.target.value })}><option>Tugas</option><option>Quiz</option><option>UTS</option><option>UAS</option><option>Proyek</option><option>Lainnya</option></select></div><div className="field small-field"><label>Maks.</label><input className="input" type="number" min="1" value={newAssessment.max_score} onChange={(e) => setNewAssessment({ ...newAssessment, max_score: Number(e.target.value) })}/></div><div className="field small-field"><label>Bobot %</label><input className="input" type="number" min="0" max="100" value={newAssessment.weight} onChange={(e) => setNewAssessment({ ...newAssessment, weight: Number(e.target.value) })}/></div><button className="btn btn-secondary" onClick={addAssessment}>Tambah Komponen</button></div>
              <div className="assessment-chips">{courseAssessments.map((item) => <div className="assessment-chip" key={item.id}><span><strong>{item.name}</strong><small>{item.category} · maks {item.max_score} · {item.weight}%</small></span><button onClick={() => editAssessment(item)}>Edit</button><button className="danger-link" onClick={() => deleteAssessment(item)}>Hapus</button></div>)}</div>
            </div>
            <div className="table-wrap"><table className="admin-table grade-input-table"><thead><tr><th>No</th><th>NPM</th><th>Nama</th>{courseAssessments.map((item) => <th key={item.id}>{item.name}<small>Maks {item.max_score}</small></th>)}<th>Nilai Akhir</th></tr></thead><tbody>{courseStudents.map((student, index) => { const final = calculateFinalScore(student.id, courseAssessments, gradeMap); return <tr key={student.id}><td>{index + 1}</td><td>{student.npm}</td><td><strong>{student.name}</strong></td>{courseAssessments.map((item) => { const key = `${item.id}:${student.id}`; const initialValue = gradeDraft[key] ?? (gradeMap.has(key) ? String(gradeMap.get(key)) : ""); return <td key={item.id}><input className="score-input" type="number" min="0" max={item.max_score} step="0.01" value={initialValue} onChange={(e) => setGradeDraft((d) => ({ ...d, [key]: e.target.value }))}/></td>; })}<td><strong>{final.score.toFixed(2)}</strong></td></tr>; })}</tbody></table></div>
            <div className="save-row"><span className="muted">Pastikan total bobot idealnya 100%.</span><button className="btn btn-primary" onClick={saveGrades} disabled={saving}>{saving ? "Menyimpan..." : "Simpan Semua Nilai"}</button></div>
          </div></section>}

          {tab === "students" && (
  <section className="panel">
    <div className="panel-head">
      <div>
        <h2>Data Mahasiswa</h2>
        <p>Mahasiswa terikat pada kelas aktif.</p>
      </div>

      <span className="badge neutral">
        {courseStudents.length} mahasiswa
      </span>
    </div>

    <div className="panel-body">

      {/* IMPORT MAHASISWA DARI TXT */}
      <div style={{ marginBottom: 24 }}>
        <ImportStudentsTxt
          courseId={selectedCourseId}
          onSuccess={refreshStudents}
        />
      </div>

      {/* TAMBAH MAHASISWA MANUAL */}
      <div
        className="inline-form"
        style={{ marginBottom: 16 }}
      >
        <div className="field">
          <label>NPM</label>

          <input
            className="input"
            value={newNpm}
            onChange={(e) => setNewNpm(e.target.value)}
            placeholder="25316000"
          />
        </div>

        <div className="field">
          <label>Nama Mahasiswa</label>

          <input
            className="input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="NAMA MAHASISWA"
          />
        </div>

        <button
          className="btn btn-primary"
          onClick={addStudent}
        >
          Tambah Mahasiswa
        </button>
      </div>

      {/* DAFTAR MAHASISWA */}
      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>No</th>
              <th>NPM</th>
              <th>Nama</th>
              <th>Aksi</th>
            </tr>
          </thead>

          <tbody>
            {courseStudents.map((student, i) => (
              <tr key={student.id}>
                <td>{i + 1}</td>

                <td>{student.npm}</td>

                <td>
                  <strong>{student.name}</strong>
                </td>

                <td>
                  <div className="admin-actions">
                    <button
                      className="btn btn-secondary btn-small"
                      onClick={() => renameStudent(student)}
                    >
                      Ubah
                    </button>

                    <button
                      className="btn btn-danger btn-small"
                      onClick={() => deleteStudent(student)}
                    >
                      Hapus
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  </section>
)}

          {tab === "settings" && <section className="panel"><div className="panel-head"><div><h2>Pengaturan Kelas</h2><p>Ubah identitas dan publikasi nilai.</p></div></div><div className="panel-body form-grid-3">
            <div className="field"><label>Mata Kuliah</label><input className="input" value={String(courseDraft.name ?? "")} onChange={(e) => setCourseDraft({ ...courseDraft, name: e.target.value })}/></div><div className="field"><label>Kelas</label><input className="input" value={String(courseDraft.class_name ?? "")} onChange={(e) => setCourseDraft({ ...courseDraft, class_name: e.target.value })}/></div><div className="field"><label>Dosen Pengampu</label><input className="input" value={String(courseDraft.lecturer ?? "")} onChange={(e) => setCourseDraft({ ...courseDraft, lecturer: e.target.value })}/></div>
            <div className="field"><label>Jadwal</label><input className="input" value={String(courseDraft.schedule ?? "")} onChange={(e) => setCourseDraft({ ...courseDraft, schedule: e.target.value })}/></div><div className="field"><label>Semester</label><input className="input" value={String(courseDraft.semester ?? "")} onChange={(e) => setCourseDraft({ ...courseDraft, semester: e.target.value })}/></div><div className="field"><label>Tahun Akademik</label><input className="input" value={String(courseDraft.academic_year ?? "")} onChange={(e) => setCourseDraft({ ...courseDraft, academic_year: e.target.value })}/></div>
            <div className="field"><label>Batas Kehadiran (%)</label><input className="input" type="number" min="0" max="100" value={Number(courseDraft.min_attendance_pct ?? 80)} onChange={(e) => setCourseDraft({ ...courseDraft, min_attendance_pct: Number(e.target.value) })}/></div><div className="field checkbox-field"><label><input type="checkbox" checked={Boolean(courseDraft.publish_grades)} onChange={(e) => setCourseDraft({ ...courseDraft, publish_grades: e.target.checked })}/> Publikasikan nilai di halaman Rekap</label><small>Jika mati, nilai hanya dapat dilihat admin.</small></div>
            <div className="form-actions-full"><button className="btn btn-primary" onClick={saveCourseSettings}>Simpan Pengaturan</button><button className="btn btn-danger" onClick={deleteCourse}>Hapus Kelas</button></div>
          </div></section>}
        </> : !showAddCourse && <div className="setup-box"><h2>Pilih atau tambah kelas</h2><p className="muted">Gunakan daftar kelas di sebelah kiri.</p></div>}
      </div>
    </div>
  </div></section>;
}
