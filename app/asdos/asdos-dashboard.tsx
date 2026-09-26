"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { STATUS_LABELS, formatLongDate } from "@/lib/attendance";
import type { Attendance, AttendanceStatus, Course, Meeting, Student } from "@/lib/types";
import type { AssistantActivityLog, AssistantProfile, AssistantScheduleTemplate, ParsedAssistantSchedule, CourseScheduleSlot } from "@/lib/asdos/types";
import AttendanceQR from "@/components/admin/AttendanceQR";

type Tab = "dashboard" | "attendance" | "schedule" | "recap" | "import";
type StatusValue = AttendanceStatus | "";

type Props = {
  profile: AssistantProfile;
  initialCourses: Course[];
  initialStudents: Student[];
  initialMeetings: Meeting[];
  initialAttendance: Attendance[];
  initialSchedules: AssistantScheduleTemplate[];
  initialCourseSchedules: CourseScheduleSlot[];
  initialLogs: AssistantActivityLog[];
};

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function periodForMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  const end = new Date(Date.UTC(year, month - 1, 24));
  const start = new Date(Date.UTC(year, month - 2, 26));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function formatPeriodDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(Date.UTC(year, month - 1, day)));
}

function periodLabel(start: string, end: string) {
  return `${formatPeriodDate(start)} s.d. ${formatPeriodDate(end)}`;
}

export default function AsdosDashboard(props: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [courses] = useState(props.initialCourses);
  const [students, setStudents] = useState(props.initialStudents);
  const [meetings, setMeetings] = useState(props.initialMeetings);
  const [attendance, setAttendance] = useState(props.initialAttendance);
  const [schedules, setSchedules] = useState(props.initialSchedules);
  const [courseSchedules, setCourseSchedules] = useState(props.initialCourseSchedules);
  const [logs, setLogs] = useState(props.initialLogs);
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id ?? "");
  const [selectedMeetingId, setSelectedMeetingId] = useState("");
  const [attendanceDraft, setAttendanceDraft] = useState<Record<string, StatusValue>>({});
  const [month, setMonth] = useState(currentMonth());
  const initialPeriod = periodForMonth(currentMonth());
  const [periodStart, setPeriodStart] = useState(initialPeriod.start);
  const [periodEnd, setPeriodEnd] = useState(initialPeriod.end);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedAssistantSchedule[]>([]);
  const [previewFilename, setPreviewFilename] = useState("");
  const [importing, setImporting] = useState(false);
  const [manual, setManual] = useState({ course_id: "", activity_date: "", start_time: "", end_time: "", room: "", material: "", activity_type: "Mengajar", notes: "" });
  const [newNpm, setNewNpm] = useState("");
  const [newStudentName, setNewStudentName] = useState("");

  const selectedCourse = courses.find((course) => course.id === selectedCourseId);
  const courseStudents = students.filter((student) => student.course_id === selectedCourseId);
  const courseMeetings = meetings.filter((meeting) => meeting.course_id === selectedCourseId).sort((a, b) => a.meeting_no - b.meeting_no);
  const selectedMeeting = courseMeetings.find((meeting) => meeting.id === selectedMeetingId);
  const courseScheduleSlots = courseSchedules
    .filter((schedule) => schedule.course_id === selectedCourseId)
    .sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time));

  useEffect(() => {
    const meetingId = courseMeetings[0]?.id ?? "";
    setSelectedMeetingId(meetingId);
  }, [selectedCourseId]);

  useEffect(() => {
    const map: Record<string, StatusValue> = {};
    courseStudents.forEach((student) => {
      map[student.id] = attendance.find((item) => item.meeting_id === selectedMeetingId && item.student_id === student.id)?.status ?? "";
    });
    setAttendanceDraft(map);
  }, [selectedMeetingId, attendance, selectedCourseId]);

  const periodLogs = useMemo(() => logs
    .filter((log) => log.activity_date >= periodStart && log.activity_date <= periodEnd)
    .sort((a, b) => `${a.activity_date}${a.start_time}`.localeCompare(`${b.activity_date}${b.start_time}`)), [logs, periodStart, periodEnd]);
  const totalMinutes = periodLogs.reduce((sum, log) => {
    const [sh, sm] = log.start_time.slice(0, 5).split(":").map(Number);
    const [eh, em] = log.end_time.slice(0, 5).split(":").map(Number);
    return sum + Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
  }, 0);

  function notify(text: string) {
    setMessage(text);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/asdos/login");
    router.refresh();
  }

  async function addStudent() {
    if (!selectedCourseId) {
      notify("Pilih mata kuliah terlebih dahulu.");
      return;
    }

    const npm = newNpm.trim();
    const name = newStudentName.trim();

    if (!npm || !name) {
      notify("NPM dan nama mahasiswa wajib diisi.");
      return;
    }

    if (name.length < 2) {
      notify("Nama mahasiswa minimal 2 karakter.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { data, error } = await supabase.rpc("add_student_for_assistant", {
      target_course_id: selectedCourseId,
      target_npm: npm,
      target_name: name,
    });

    if (error) {
      notify(`Gagal menambah mahasiswa: ${error.message}`);
      setSaving(false);
      return;
    }

    const created = Array.isArray(data) ? data[0] : data;

    if (!created?.id) {
      notify("Mahasiswa berhasil diproses, tetapi data baru tidak dapat dibaca.");
      setSaving(false);
      return;
    }

    setStudents((items) => [...items, created as Student].sort((a, b) => a.npm.localeCompare(b.npm)));
    setAttendanceDraft((current) => ({ ...current, [created.id]: "" }));
    setNewNpm("");
    setNewStudentName("");
    notify(`${String(created.name)} berhasil ditambahkan ke kelas.`);
    setSaving(false);
  }

  async function syncCourseMeetings() {
    if (!selectedCourseId) {
      notify("Pilih mata kuliah terlebih dahulu.");
      return;
    }

    if (!courseScheduleSlots.length) {
      notify("Belum ada jadwal mingguan yang terhubung ke mata kuliah ini. Import jadwal Excel terlebih dahulu.");
      return;
    }

    const slotText = courseScheduleSlots
      .map((slot) => `${slot.day_name} ${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)}`)
      .join(", ");

    const ok = window.confirm(
      `Sinkronkan tanggal P1–P${courseMeetings.length} berdasarkan ${courseScheduleSlots.length} jadwal per minggu?\n\n${slotText}\n\nTanggal P1 yang sekarang menjadi titik awal penyusunan jadwal.`
    );

    if (!ok) return;

    setSaving(true);
    setMessage("");

    const { data, error } = await supabase.rpc("sync_course_meetings_from_shared_schedule", {
      target_course_id: selectedCourseId,
    });

    if (error) {
      notify(`Gagal menyinkronkan tanggal pertemuan: ${error.message}`);
      setSaving(false);
      return;
    }

    const { data: refreshed, error: refreshError } = await supabase
      .from("meetings")
      .select("*")
      .eq("course_id", selectedCourseId)
      .order("meeting_no");

    if (refreshError) {
      notify(`Tanggal pertemuan berhasil disinkronkan, tetapi refresh gagal: ${refreshError.message}`);
      setSaving(false);
      return;
    }

    setMeetings((items) => [
      ...items.filter((meeting) => meeting.course_id !== selectedCourseId),
      ...((refreshed ?? []) as Meeting[]),
    ]);

    const updatedCount = typeof data === "number" ? data : Number(data ?? courseMeetings.length);
    notify(`${updatedCount || courseMeetings.length} tanggal pertemuan berhasil disinkronkan (${courseScheduleSlots.length} pertemuan/minggu).`);
    setSaving(false);
  }

  async function renameStudent(student: Student) {
    const nextName = window.prompt("Nama mahasiswa:", student.name)?.trim();

    if (!nextName || nextName === student.name) return;

    if (nextName.length < 2) {
      notify("Nama mahasiswa minimal 2 karakter.");
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase.rpc("rename_student_for_assistant", {
      target_student_id: student.id,
      new_name: nextName,
    });

    if (error) {
      notify(`Gagal mengubah nama mahasiswa: ${error.message}`);
      setSaving(false);
      return;
    }

    const normalizedName = nextName.toUpperCase();

    setStudents((items) =>
      items.map((item) =>
        item.id === student.id
          ? { ...item, name: normalizedName }
          : item,
      ),
    );

    notify(`Nama mahasiswa berhasil diubah menjadi ${normalizedName}.`);
    setSaving(false);
  }

  async function saveAttendance() {
    if (!selectedMeetingId) return;
    setSaving(true);
    const filled = courseStudents.filter((student) => attendanceDraft[student.id]).map((student) => ({ meeting_id: selectedMeetingId, student_id: student.id, status: attendanceDraft[student.id] as AttendanceStatus }));
    const blankIds = courseStudents.filter((student) => !attendanceDraft[student.id]).map((student) => attendance.find((item) => item.meeting_id === selectedMeetingId && item.student_id === student.id)?.id).filter(Boolean) as string[];

    if (filled.length) {
      const { error } = await supabase.from("attendance").upsert(filled, { onConflict: "meeting_id,student_id" });
      if (error) { notify(`Gagal menyimpan absensi: ${error.message}`); setSaving(false); return; }
    }
    if (blankIds.length) {
      const { error } = await supabase.from("attendance").delete().in("id", blankIds);
      if (error) { notify(`Gagal mengosongkan absensi: ${error.message}`); setSaving(false); return; }
    }
    const { data, error } = await supabase.from("attendance").select("*");
    if (error) { notify(`Absensi tersimpan, tetapi refresh gagal: ${error.message}`); setSaving(false); return; }
    setAttendance((data ?? []) as Attendance[]);
    notify("Absensi mahasiswa berhasil disimpan.");
    setSaving(false);
  }

  async function previewExcel() {
    if (!importFile) { notify("Pilih file Excel terlebih dahulu."); return; }
    setImporting(true);
    setPreview([]);
    const form = new FormData();
    form.append("file", importFile);
    const response = await fetch("/api/asdos/import", { method: "POST", body: form });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      notify(result.error ?? "Gagal membaca Excel.");
      setImporting(false);
      return;
    }
    setPreview(result.entries ?? []);
    setPreviewFilename(result.filename ?? importFile.name);
    notify(`Preview berhasil: ${result.entries?.length ?? 0} jadwal ditemukan.`);
    setImporting(false);
  }

  async function confirmImport() {
    if (!preview.length) return;
    setImporting(true);
    const response = await fetch("/api/asdos/import/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: previewFilename, entries: preview }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { notify(result.error ?? "Gagal menyimpan jadwal."); setImporting(false); return; }
    const [{ data }, { data: sharedData }] = await Promise.all([
      supabase.from("assistant_schedule_templates").select("*").eq("assistant_user_id", props.profile.user_id).order("weekday").order("start_time"),
      courses.length
        ? supabase.from("course_schedules").select("*").in("course_id", courses.map((course) => course.id)).order("weekday").order("start_time")
        : Promise.resolve({ data: [] }),
    ]);
    setSchedules((data ?? []) as AssistantScheduleTemplate[]);
    setCourseSchedules((sharedData ?? []) as CourseScheduleSlot[]);
    setPreview([]);
    notify(`${result.imported_count ?? 0} jadwal berhasil disimpan.`);
    setImporting(false);
    setTab("schedule");
  }

  async function deleteSchedule(schedule: AssistantScheduleTemplate) {
    const ok = window.confirm(
      `Hapus jadwal ${schedule.day_name} ${schedule.start_time.slice(0, 5)}–${schedule.end_time.slice(0, 5)}\n${schedule.course_name} — ${schedule.class_label}?\n\nRekap draft yang dibuat dari jadwal ini juga akan dihapus. Rekap yang sudah diajukan/disetujui tetap disimpan.`
    );
    if (!ok) return;

    setSaving(true);
    setMessage("");

    const { error: draftError } = await supabase
      .from("assistant_activity_logs")
      .delete()
      .eq("assistant_user_id", props.profile.user_id)
      .eq("schedule_template_id", schedule.id)
      .eq("status", "draft");

    if (draftError) {
      notify(`Gagal menghapus rekap draft terkait: ${draftError.message}`);
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("assistant_schedule_templates")
      .delete()
      .eq("id", schedule.id)
      .eq("assistant_user_id", props.profile.user_id);

    if (error) {
      notify(`Gagal menghapus jadwal: ${error.message}`);
      setSaving(false);
      return;
    }

    if (schedule.course_id) {
      await supabase
        .from("course_schedules")
        .delete()
        .eq("course_id", schedule.course_id)
        .eq("weekday", schedule.weekday)
        .eq("start_time", schedule.start_time)
        .eq("end_time", schedule.end_time)
        .eq("source_assistant_user_id", props.profile.user_id);

      setCourseSchedules((items) =>
        items.filter(
          (item) =>
            !(
              item.course_id === schedule.course_id &&
              item.weekday === schedule.weekday &&
              item.start_time.slice(0, 5) === schedule.start_time.slice(0, 5) &&
              item.end_time.slice(0, 5) === schedule.end_time.slice(0, 5) &&
              item.source_assistant_user_id === props.profile.user_id
            ),
        ),
      );
    }

    setSchedules((items) => items.filter((item) => item.id !== schedule.id));
    setLogs((items) =>
      items.filter(
        (item) =>
          item.schedule_template_id !== schedule.id || item.status !== "draft",
      ),
    );
    notify("Jadwal asistensi berhasil dihapus.");
    setSaving(false);
  }

  async function deleteImportedFile(filename: string) {
    const related = schedules.filter((item) => item.source_filename === filename);
    if (!related.length) return;

    const ok = window.confirm(
      `Hapus semua ${related.length} jadwal hasil import dari file \"${filename}\"?\n\nRekap draft yang berasal dari jadwal tersebut juga akan dihapus. Rekap yang sudah diajukan/disetujui tetap disimpan.`
    );
    if (!ok) return;

    setSaving(true);
    setMessage("");
    const ids = related.map((item) => item.id);

    const { error: draftError } = await supabase
      .from("assistant_activity_logs")
      .delete()
      .eq("assistant_user_id", props.profile.user_id)
      .in("schedule_template_id", ids)
      .eq("status", "draft");

    if (draftError) {
      notify(`Gagal menghapus rekap draft terkait: ${draftError.message}`);
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("assistant_schedule_templates")
      .delete()
      .eq("assistant_user_id", props.profile.user_id)
      .eq("source_filename", filename);

    await supabase
      .from("course_schedules")
      .delete()
      .eq("source_assistant_user_id", props.profile.user_id)
      .eq("source_filename", filename);

    if (error) {
      notify(`Gagal menghapus hasil import: ${error.message}`);
      setSaving(false);
      return;
    }

    const idSet = new Set(ids);
    setSchedules((items) => items.filter((item) => !idSet.has(item.id)));
    setLogs((items) =>
      items.filter(
        (item) =>
          !item.schedule_template_id ||
          !idSet.has(item.schedule_template_id) ||
          item.status !== "draft",
      ),
    );
    notify(`Semua jadwal dari file ${filename} berhasil dihapus.`);
    setSaving(false);
  }

  async function deleteAllSchedules() {
    if (!schedules.length) return;

    const ok = window.confirm(
      `Hapus SEMUA ${schedules.length} jadwal asistensi milik kamu?\n\nGunakan ini hanya jika import benar-benar salah. Rekap draft terkait ikut dihapus; rekap yang sudah diajukan/disetujui tetap disimpan.`
    );
    if (!ok) return;

    setSaving(true);
    setMessage("");
    const ids = schedules.map((item) => item.id);

    const { error: draftError } = await supabase
      .from("assistant_activity_logs")
      .delete()
      .eq("assistant_user_id", props.profile.user_id)
      .in("schedule_template_id", ids)
      .eq("status", "draft");

    if (draftError) {
      notify(`Gagal menghapus rekap draft terkait: ${draftError.message}`);
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("assistant_schedule_templates")
      .delete()
      .eq("assistant_user_id", props.profile.user_id);

    if (error) {
      notify(`Gagal menghapus semua jadwal: ${error.message}`);
      setSaving(false);
      return;
    }

    await supabase
      .from("course_schedules")
      .delete()
      .eq("source_assistant_user_id", props.profile.user_id);

    setCourseSchedules((items) =>
      items.filter((item) => item.source_assistant_user_id !== props.profile.user_id),
    );

    const idSet = new Set(ids);
    setSchedules([]);
    setLogs((items) =>
      items.filter(
        (item) =>
          !item.schedule_template_id ||
          !idSet.has(item.schedule_template_id) ||
          item.status !== "draft",
      ),
    );
    notify("Semua jadwal asistensi berhasil dihapus.");
    setSaving(false);
  }

  function changePeriodMonth(value: string) {
    setMonth(value);
    const next = periodForMonth(value);
    setPeriodStart(next.start);
    setPeriodEnd(next.end);
  }

  async function generateMonth() {
    if (!periodStart || !periodEnd) { notify("Tanggal mulai dan tanggal akhir wajib diisi."); return; }
    if (periodStart > periodEnd) { notify("Tanggal mulai tidak boleh lebih besar dari tanggal akhir."); return; }
    setSaving(true);
    const response = await fetch("/api/asdos/generate-month", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start_date: periodStart, end_date: periodEnd }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { notify(result.error ?? "Gagal membuat rekap periode."); setSaving(false); return; }
    setLogs(result.logs ?? []);
    notify(`Rekap ${periodLabel(periodStart, periodEnd)} berhasil dibuat dari jadwal.`);
    setSaving(false);
    setTab("recap");
  }

  async function saveLog(log: AssistantActivityLog) {
    const { error } = await supabase.from("assistant_activity_logs").update({
      room: log.room,
      material: log.material,
      activity_type: log.activity_type,
      notes: log.notes,
      status: log.status,
    }).eq("id", log.id);
    if (error) { notify(`Gagal menyimpan rekap: ${error.message}`); return; }
    notify("Rekap kegiatan diperbarui.");
  }

  async function deleteLog(id: string) {
    if (!window.confirm("Hapus kegiatan ini dari rekap Asdos?")) return;
    const { error } = await supabase.from("assistant_activity_logs").delete().eq("id", id);
    if (error) { notify(`Gagal menghapus: ${error.message}`); return; }
    setLogs((items) => items.filter((item) => item.id !== id));
    notify("Kegiatan dihapus.");
  }

  async function addManualLog() {
    const course = courses.find((item) => item.id === manual.course_id);
    if (!course || !manual.activity_date || !manual.start_time || !manual.end_time) { notify("Lengkapi mata kuliah, tanggal, dan jam kegiatan."); return; }
    const { data, error } = await supabase.from("assistant_activity_logs").insert({
      assistant_user_id: props.profile.user_id,
      course_id: course.id,
      activity_date: manual.activity_date,
      start_time: manual.start_time,
      end_time: manual.end_time,
      class_label: course.class_name,
      room: manual.room,
      course_name: course.name,
      material: manual.material,
      lecturer_name: course.lecturer,
      activity_type: manual.activity_type,
      notes: manual.notes,
      status: "draft",
    }).select("*").single();
    if (error || !data) { notify(`Gagal menambah kegiatan: ${error?.message ?? "Unknown error"}`); return; }
    setLogs((items) => [data as AssistantActivityLog, ...items]);
    setManual({ course_id: "", activity_date: "", start_time: "", end_time: "", room: "", material: "", activity_type: "Mengajar", notes: "" });
    notify("Kegiatan Asdos berhasil ditambahkan.");
  }

  return (
    <section className="page">
      <div className="shell">
        <div className="hero">
          <div>
            <div className="eyebrow">Portal Asisten Dosen</div>
            <h1>Halo, {props.profile.full_name}</h1>
            <p>Kelola jadwal asistensi, rekap kegiatan bulanan, dan presensi mahasiswa untuk mata kuliah yang ditugaskan.</p>
          </div>
          <div className="admin-actions">
            <span className="badge neutral">@{props.profile.username}</span>
            <button className="btn btn-secondary" onClick={logout}>Keluar</button>
          </div>
        </div>

        {message && <div className={message.toLowerCase().includes("gagal") || message.toLowerCase().includes("lengkapi") ? "error" : "success"} style={{ marginBottom: 14 }}>{message}</div>}

        <div className="tab-bar" style={{ flexWrap: "wrap", marginBottom: 18 }}>
          <button className={`tab-btn ${tab === "dashboard" ? "active" : ""}`} onClick={() => setTab("dashboard")}>Dashboard</button>
          <button className={`tab-btn ${tab === "attendance" ? "active" : ""}`} onClick={() => setTab("attendance")}>Absensi Mahasiswa</button>
          <button className={`tab-btn ${tab === "schedule" ? "active" : ""}`} onClick={() => setTab("schedule")}>Jadwal Asistensi</button>
          <button className={`tab-btn ${tab === "recap" ? "active" : ""}`} onClick={() => setTab("recap")}>Rekap Kehadiran Asdos</button>
          <button className={`tab-btn ${tab === "import" ? "active" : ""}`} onClick={() => setTab("import")}>Import Excel</button>
        </div>

        {tab === "dashboard" && <>
          <div className="stat-grid">
            <div className="stat-card"><div className="value">{courses.length}</div><div className="label">Mata Kuliah Diasisteni</div></div>
            <div className="stat-card"><div className="value">{schedules.length}</div><div className="label">Jadwal Mingguan</div></div>
            <div className="stat-card"><div className="value">{periodLogs.length}</div><div className="label">Kegiatan Periode Ini</div></div>
            <div className="stat-card highlight"><div className="value">{(totalMinutes / 60).toFixed(totalMinutes % 60 ? 1 : 0)}</div><div className="label">Jam Asistensi Bulan Ini</div></div>
          </div>

          <section className="panel" style={{ marginTop: 18 }}>
            <div className="panel-head"><div><h2>Mata Kuliah Saya</h2><p>Hanya mata kuliah yang ditugaskan oleh dosen/Super Admin.</p></div></div>
            <div className="panel-body" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
              {courses.map((course) => <button key={course.id} className="course-btn" onClick={() => { setSelectedCourseId(course.id); setTab("attendance"); }}><strong>{course.name}</strong><span>{course.class_name} · {course.lecturer}</span></button>)}
              {courses.length === 0 && <div className="empty-state">Belum ada mata kuliah yang ditugaskan ke akun Asdos ini.</div>}
            </div>
          </section>
        </>}

        {tab === "attendance" && <section className="panel">
          <div className="panel-head"><div><h2>Kelola Absensi Mahasiswa</h2><p>Asdos hanya dapat mengelola kelas yang ditugaskan.</p></div></div>
          <div className="panel-body">
            <div style={{ marginBottom: 18 }}>
              <strong>Jadwal Mata Kuliah (Sinkron dengan Dosen/Admin)</strong>
              <div className="table-wrap" style={{ marginTop: 10 }}>
                <table className="admin-table">
                  <thead>
                    <tr><th>Hari</th><th>Jam</th><th>Kelas</th><th>Mata Kuliah</th><th>Ruang</th><th>Sumber</th></tr>
                  </thead>
                  <tbody>
                    {courseSchedules.map((schedule) => {
                      const course = courses.find((item) => item.id === schedule.course_id);
                      return (
                        <tr key={schedule.id}>
                          <td>{schedule.day_name}</td>
                          <td>{schedule.start_time.slice(0,5)}–{schedule.end_time.slice(0,5)}</td>
                          <td>{course?.class_name ?? "—"}</td>
                          <td><strong>{course?.name ?? "—"}</strong></td>
                          <td>{schedule.room || "—"}</td>
                          <td>{schedule.source_filename ? `Import: ${schedule.source_filename}` : "Dosen/Admin"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {courseSchedules.length === 0 && <div className="empty-state">Belum ada jadwal mata kuliah bersama.</div>}
              </div>
            </div>
            <div className="form-grid-3" style={{ marginBottom: 16 }}>
              <div className="field"><label>Mata Kuliah</label><select className="select" value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)}><option value="">— Pilih Mata Kuliah —</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.name} — {course.class_name}</option>)}</select></div>
              <div className="field"><label>Pertemuan</label><select className="select" value={selectedMeetingId} onChange={(e) => setSelectedMeetingId(e.target.value)}><option value="">— Pilih Pertemuan —</option>{courseMeetings.map((meeting) => <option key={meeting.id} value={meeting.id}>P{meeting.meeting_no} — {meeting.meeting_date}</option>)}</select></div>
              <div className="field"><label>Status</label><div className="muted">{selectedMeeting ? formatLongDate(selectedMeeting.meeting_date) : "Pilih pertemuan"}</div></div>
            </div>

            {selectedCourse && (
              <div className="assessment-manager" style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <div>
                    <strong>Jadwal Mingguan Kelas</strong>
                    <div className="muted" style={{ marginTop: 5 }}>
                      {courseScheduleSlots.length > 0
                        ? courseScheduleSlots.map((slot) => `${slot.day_name} ${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)}`).join(" · ")
                        : "Belum ada jadwal import yang terhubung ke mata kuliah ini."}
                    </div>
                  </div>
                  <div className="admin-actions">
                    {courseScheduleSlots.length > 0 && <span className="badge good">{courseScheduleSlots.length} pertemuan/minggu</span>}
                    {courseScheduleSlots.length > 0 && (
                      <button type="button" className="btn btn-secondary" disabled={saving || courseMeetings.length === 0} onClick={() => void syncCourseMeetings()}>
                        Sinkronkan P1–P{courseMeetings.length}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {selectedMeeting && selectedCourse && <div style={{ marginBottom: 18 }}><AttendanceQR meetingId={selectedMeeting.id} meetingNo={selectedMeeting.meeting_no} courseName={selectedCourse.name} classLabel={selectedCourse.class_name} /></div>}

            {selectedCourse && (
              <div className="assessment-manager" style={{ marginBottom: 16 }}>
                <strong>Tambah Mahasiswa ke Kelas</strong>
                <div className="inline-form" style={{ marginTop: 10 }}>
                  <div className="field">
                    <label>NPM</label>
                    <input className="input" value={newNpm} onChange={(e) => setNewNpm(e.target.value)} placeholder="26311021" />
                  </div>
                  <div className="field">
                    <label>Nama Mahasiswa</label>
                    <input className="input" value={newStudentName} onChange={(e) => setNewStudentName(e.target.value)} placeholder="NAMA MAHASISWA" />
                  </div>
                  <button type="button" className="btn btn-primary" disabled={saving || !newNpm.trim() || !newStudentName.trim()} onClick={() => void addStudent()}>
                    + Tambah Mahasiswa
                  </button>
                </div>
                <div className="muted" style={{ marginTop: 8 }}>Asdos hanya dapat menambah mahasiswa ke kelas yang memang ditugaskan kepadanya.</div>
              </div>
            )}

            <div className="admin-actions" style={{ marginBottom: 12 }}>
              <button className="btn btn-success" onClick={() => { const next: Record<string, StatusValue> = {}; courseStudents.forEach((student) => next[student.id] = "H"); setAttendanceDraft(next); }}>Semua Hadir</button>
              <button className="btn btn-secondary" onClick={() => { const next: Record<string, StatusValue> = {}; courseStudents.forEach((student) => next[student.id] = ""); setAttendanceDraft(next); }}>Kosongkan</button>
              <button className="btn btn-primary" disabled={saving || !selectedMeetingId} onClick={saveAttendance}>{saving ? "Menyimpan..." : "Simpan Absensi"}</button>
            </div>

            <div className="table-wrap"><table className="admin-table"><thead><tr><th>No</th><th>NPM</th><th>Nama</th><th>Aksi</th><th>Status</th></tr></thead><tbody>{courseStudents.map((student, index) => <tr key={student.id}><td>{index + 1}</td><td>{student.npm}</td><td><strong>{student.name}</strong></td><td><button type="button" className="btn btn-secondary btn-small" disabled={saving} onClick={() => void renameStudent(student)}>Ubah Nama</button></td><td><select className="status-select" value={attendanceDraft[student.id] ?? ""} onChange={(e) => setAttendanceDraft((current) => ({ ...current, [student.id]: e.target.value as StatusValue }))}><option value="">— Belum diisi —</option>{(Object.keys(STATUS_LABELS) as AttendanceStatus[]).map((status) => <option key={status} value={status}>{status} — {STATUS_LABELS[status]}</option>)}</select></td></tr>)}</tbody></table></div>
          </div>
        </section>}

        {tab === "schedule" && <section className="panel">
          <div className="panel-head">
            <div><h2>Jadwal Asistensi</h2><p>Jadwal utama di bawah ini sama dengan jadwal yang diatur Dosen/Admin. Import Excel yang cocok dengan kelas akan ikut memperbarui sumber jadwal yang sama.</p></div>
            <div className="admin-actions">
              <button className="btn btn-secondary" onClick={() => setTab("import")}>Import Excel</button>
              {schedules.length > 0 && <button className="btn btn-danger" onClick={deleteAllSchedules} disabled={saving}>Hapus Semua Jadwal</button>}
            </div>
          </div>
          <div className="panel-body">
            <div className="assessment-manager" style={{ marginBottom: 16 }}>
              <strong>Periode Rekap Kehadiran / Gaji</strong>
              <div className="form-grid-3" style={{ marginTop: 12 }}>
                <div className="field"><label>Bulan Rekap</label><input className="input" type="month" value={month} onChange={(e) => changePeriodMonth(e.target.value)} /></div>
                <div className="field"><label>Tanggal Mulai</label><input className="input" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} /></div>
                <div className="field"><label>Tanggal Akhir</label><input className="input" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} /></div>
              </div>
              <div className="save-row" style={{ marginTop: 12 }}>
                <span className="muted">Default periode: tanggal 26 bulan sebelumnya s.d. tanggal 24 bulan yang dipilih. Tanggal tetap bisa diubah manual.</span>
                <button className="btn btn-primary" onClick={generateMonth} disabled={saving}>{saving ? "Membuat..." : "Generate Rekap dari Jadwal"}</button>
              </div>
            </div>

            {Array.from(new Set(schedules.map((item) => item.source_filename).filter((value): value is string => Boolean(value)))).length > 0 && (
              <div className="assessment-manager" style={{ marginBottom: 16 }}>
                <strong>Hasil Import Excel</strong>
                <div className="admin-actions" style={{ marginTop: 10, flexWrap: "wrap" }}>
                  {Array.from(new Set(schedules.map((item) => item.source_filename).filter((value): value is string => Boolean(value)))).map((filename) => {
                    const count = schedules.filter((item) => item.source_filename === filename).length;
                    return <button key={filename} className="btn btn-danger btn-small" onClick={() => deleteImportedFile(filename)} disabled={saving}>Hapus Import: {filename} ({count})</button>;
                  })}
                </div>
              </div>
            )}

            <div className="table-wrap"><table className="admin-table"><thead><tr><th>Hari</th><th>Jam</th><th>Kelas</th><th>Mata Kuliah</th><th>Dosen</th><th>Ruang</th><th>Sumber</th><th>Link DB</th><th>Aksi</th></tr></thead><tbody>{schedules.map((schedule) => <tr key={schedule.id}><td>{schedule.day_name}</td><td>{schedule.start_time.slice(0,5)}–{schedule.end_time.slice(0,5)}</td><td>{schedule.class_label}</td><td><strong>{schedule.course_name}</strong></td><td>{schedule.lecturer_name}</td><td>{schedule.room || "—"}</td><td>{schedule.source_filename || "Manual"}</td><td><span className={`badge ${schedule.course_id ? "good" : "warn"}`}>{schedule.course_id ? "Terhubung" : "Belum cocok"}</span></td><td><button className="btn btn-danger btn-small" onClick={() => deleteSchedule(schedule)} disabled={saving}>Hapus</button></td></tr>)}</tbody></table>{schedules.length === 0 && <div className="empty-state">Belum ada jadwal. Gunakan Import Excel.</div>}</div>
          </div>
        </section>}

        {tab === "recap" && <section className="panel">
          <div className="panel-head">
            <div><h2>Rekap Kehadiran Asdos</h2><p>Hanya kegiatan pada tanggal mulai–akhir yang dipilih yang ditampilkan dan dicetak.</p></div>
            <div className="admin-actions"><Link className="btn btn-primary" href={`/asdos/print?month=${month}&start=${periodStart}&end=${periodEnd}`} target="_blank">🖨 Print Rekap</Link></div>
          </div>
          <div className="panel-body">
            <div className="assessment-manager" style={{ marginBottom: 18 }}>
              <strong>Periode Rekap Kehadiran / Gaji</strong>
              <div className="form-grid-3" style={{ marginTop: 12 }}>
                <div className="field"><label>Bulan Rekap</label><input className="input" type="month" value={month} onChange={(e) => changePeriodMonth(e.target.value)} /></div>
                <div className="field"><label>Tanggal Mulai</label><input className="input" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} /></div>
                <div className="field"><label>Tanggal Akhir</label><input className="input" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} /></div>
              </div>
              <div className="save-row" style={{ marginTop: 12 }}>
                <span><strong>{periodLabel(periodStart, periodEnd)}</strong></span>
                <button className="btn btn-secondary" onClick={generateMonth} disabled={saving}>{saving ? "Membuat..." : "Generate / Refresh dari Jadwal"}</button>
              </div>
            </div>
            <div className="assessment-manager" style={{ marginBottom: 18 }}>
              <h3 style={{ marginTop: 0 }}>Tambah Kegiatan Manual</h3>
              <div className="form-grid-3">
                <div className="field"><label>Mata Kuliah</label><select className="select" value={manual.course_id} onChange={(e) => setManual({ ...manual, course_id: e.target.value })}><option value="">— Pilih —</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.name} — {course.class_name}</option>)}</select></div>
                <div className="field"><label>Tanggal</label><input className="input" type="date" min={periodStart} max={periodEnd} value={manual.activity_date} onChange={(e) => setManual({ ...manual, activity_date: e.target.value })} /></div>
                <div className="field"><label>Ruang</label><input className="input" value={manual.room} onChange={(e) => setManual({ ...manual, room: e.target.value })} /></div>
                <div className="field"><label>Jam Mulai</label><input className="input" type="time" value={manual.start_time} onChange={(e) => setManual({ ...manual, start_time: e.target.value })} /></div>
                <div className="field"><label>Jam Selesai</label><input className="input" type="time" value={manual.end_time} onChange={(e) => setManual({ ...manual, end_time: e.target.value })} /></div>
                <div className="field"><label>Jenis Kegiatan</label><select className="select" value={manual.activity_type} onChange={(e) => setManual({ ...manual, activity_type: e.target.value })}><option>Mengajar</option><option>Mendampingi Praktikum</option><option>Menggantikan Dosen</option><option>Asistensi</option><option>Pengawasan</option><option>Lainnya</option></select></div>
                <div className="field"><label>Materi</label><input className="input" value={manual.material} onChange={(e) => setManual({ ...manual, material: e.target.value })} /></div>
                <div className="field"><label>Keterangan</label><input className="input" value={manual.notes} onChange={(e) => setManual({ ...manual, notes: e.target.value })} /></div>
                <div className="field"><label>&nbsp;</label><button className="btn btn-secondary" onClick={addManualLog}>+ Tambah Kegiatan</button></div>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}><strong>{monthLabel(month)}</strong> · {periodLabel(periodStart, periodEnd)} · {periodLogs.length} kegiatan · {(totalMinutes / 60).toFixed(totalMinutes % 60 ? 1 : 0)} jam</div>
            <div className="table-wrap"><table className="admin-table"><thead><tr><th>No</th><th>Tanggal/Jam</th><th>Kelas & MK</th><th>Ruang</th><th>Materi</th><th>Kegiatan</th><th>Keterangan</th><th>Aksi</th></tr></thead><tbody>{periodLogs.map((log, index) => <tr key={log.id}><td>{index + 1}</td><td>{log.activity_date}<br/><small>{log.start_time.slice(0,5)}–{log.end_time.slice(0,5)}</small></td><td><strong>{log.course_name}</strong><br/><small>{log.class_label} · {log.lecturer_name}</small></td><td><input className="input" style={{ minWidth: 110 }} value={log.room} onChange={(e) => setLogs((items) => items.map((item) => item.id === log.id ? { ...item, room: e.target.value } : item))} /></td><td><input className="input" style={{ minWidth: 150 }} value={log.material} onChange={(e) => setLogs((items) => items.map((item) => item.id === log.id ? { ...item, material: e.target.value } : item))} /></td><td><select className="select" value={log.activity_type} onChange={(e) => setLogs((items) => items.map((item) => item.id === log.id ? { ...item, activity_type: e.target.value } : item))}><option>Mengajar</option><option>Mendampingi Praktikum</option><option>Menggantikan Dosen</option><option>Asistensi</option><option>Pengawasan</option><option>Lainnya</option></select></td><td><input className="input" style={{ minWidth: 140 }} value={log.notes} onChange={(e) => setLogs((items) => items.map((item) => item.id === log.id ? { ...item, notes: e.target.value } : item))} /></td><td><div className="admin-actions"><button className="btn btn-secondary btn-small" onClick={() => saveLog(log)}>Simpan</button><button className="btn btn-danger btn-small" onClick={() => deleteLog(log.id)}>Hapus</button></div></td></tr>)}</tbody></table>{periodLogs.length === 0 && <div className="empty-state">Belum ada kegiatan pada periode ini. Generate dari Jadwal Asistensi atau tambah manual.</div>}</div>
          </div>
        </section>}

        {tab === "import" && <section className="panel">
          <div className="panel-head"><div><h2>Import Jadwal Asisten dari Excel</h2><p>Parser dibuat untuk format file Jadwal Asisten yang kamu kirim: Nama, Prodi, Senin–Sabtu, dan slot jam.</p></div></div>
          <div className="panel-body">
            <div className="inline-form"><div className="field"><label>File Excel</label><input className="input" type="file" accept=".xlsx,.xls" onChange={(e) => setImportFile(e.target.files?.[0] ?? null)} /></div><button className="btn btn-primary" onClick={previewExcel} disabled={importing}>{importing ? "Membaca..." : "Preview Import"}</button></div>

            {preview.length > 0 && <>
              <div className="success" style={{ marginTop: 16 }}>Ditemukan {preview.length} jadwal milik <strong>{props.profile.full_name}</strong>. Cek sebelum menyimpan.</div>
              <div className="table-wrap" style={{ marginTop: 14 }}><table className="admin-table"><thead><tr><th>Hari</th><th>Jam</th><th>Kelas</th><th>Mata Kuliah</th><th>Dosen</th><th>Ruang</th><th>Database</th></tr></thead><tbody>{preview.map((entry, index) => <tr key={`${entry.source_sheet}-${entry.weekday}-${entry.start_time}-${index}`}><td>{entry.day_name}</td><td>{entry.start_time}–{entry.end_time}</td><td>{entry.class_label}</td><td><strong>{entry.course_name}</strong></td><td>{entry.lecturer_name}</td><td>{entry.room || "—"}</td><td><span className={`badge ${entry.match_status === "matched" ? "good" : "warn"}`}>{entry.match_status === "matched" ? entry.matched_course_label : "Belum ditugaskan/cocok"}</span></td></tr>)}</tbody></table></div>
              <div className="save-row"><span className="muted">Jadwal yang belum cocok tetap dapat disimpan untuk rekap, tetapi tidak memberi akses ke kelas. Akses kelas tetap harus diberikan dosen.</span><button className="btn btn-primary" onClick={confirmImport} disabled={importing}>{importing ? "Menyimpan..." : `Simpan ${preview.length} Jadwal`}</button></div>
            </>}
          </div>
        </section>}
      </div>
    </section>
  );
}
