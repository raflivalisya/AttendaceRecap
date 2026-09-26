"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { STATUS_LABELS, formatLongDate } from "@/lib/attendance";
import type { Attendance, AttendanceStatus, Course, Meeting, Student } from "@/lib/types";
import type { AssistantActivityLog, AssistantProfile, AssistantScheduleTemplate, ParsedAssistantSchedule } from "@/lib/asdos/types";
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

export default function AsdosDashboard(props: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [courses] = useState(props.initialCourses);
  const [students] = useState(props.initialStudents);
  const [meetings] = useState(props.initialMeetings);
  const [attendance, setAttendance] = useState(props.initialAttendance);
  const [schedules, setSchedules] = useState(props.initialSchedules);
  const [logs, setLogs] = useState(props.initialLogs);
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id ?? "");
  const [selectedMeetingId, setSelectedMeetingId] = useState("");
  const [attendanceDraft, setAttendanceDraft] = useState<Record<string, StatusValue>>({});
  const [month, setMonth] = useState(currentMonth());
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedAssistantSchedule[]>([]);
  const [previewFilename, setPreviewFilename] = useState("");
  const [importing, setImporting] = useState(false);
  const [manual, setManual] = useState({ course_id: "", activity_date: "", start_time: "", end_time: "", room: "", material: "", activity_type: "Mengajar", notes: "" });

  const selectedCourse = courses.find((course) => course.id === selectedCourseId);
  const courseStudents = students.filter((student) => student.course_id === selectedCourseId);
  const courseMeetings = meetings.filter((meeting) => meeting.course_id === selectedCourseId).sort((a, b) => a.meeting_no - b.meeting_no);
  const selectedMeeting = courseMeetings.find((meeting) => meeting.id === selectedMeetingId);

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

  const monthLogs = useMemo(() => logs.filter((log) => log.activity_date.startsWith(month)).sort((a, b) => `${a.activity_date}${a.start_time}`.localeCompare(`${b.activity_date}${b.start_time}`)), [logs, month]);
  const totalMinutes = monthLogs.reduce((sum, log) => {
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
    const { data } = await supabase.from("assistant_schedule_templates").select("*").eq("assistant_user_id", props.profile.user_id).order("weekday").order("start_time");
    setSchedules((data ?? []) as AssistantScheduleTemplate[]);
    setPreview([]);
    notify(`${result.imported_count ?? 0} jadwal berhasil disimpan.`);
    setImporting(false);
    setTab("schedule");
  }

  async function generateMonth() {
    setSaving(true);
    const response = await fetch("/api/asdos/generate-month", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { notify(result.error ?? "Gagal membuat rekap bulanan."); setSaving(false); return; }
    setLogs(result.logs ?? []);
    notify(`Rekap ${monthLabel(month)} berhasil dibuat dari jadwal.`);
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
            <div className="stat-card"><div className="value">{monthLogs.length}</div><div className="label">Kegiatan Bulan Ini</div></div>
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
            <div className="form-grid-3" style={{ marginBottom: 16 }}>
              <div className="field"><label>Mata Kuliah</label><select className="select" value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)}><option value="">— Pilih Mata Kuliah —</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.name} — {course.class_name}</option>)}</select></div>
              <div className="field"><label>Pertemuan</label><select className="select" value={selectedMeetingId} onChange={(e) => setSelectedMeetingId(e.target.value)}><option value="">— Pilih Pertemuan —</option>{courseMeetings.map((meeting) => <option key={meeting.id} value={meeting.id}>P{meeting.meeting_no} — {meeting.meeting_date}</option>)}</select></div>
              <div className="field"><label>Status</label><div className="muted">{selectedMeeting ? formatLongDate(selectedMeeting.meeting_date) : "Pilih pertemuan"}</div></div>
            </div>

            {selectedMeeting && selectedCourse && <div style={{ marginBottom: 18 }}><AttendanceQR meetingId={selectedMeeting.id} meetingNo={selectedMeeting.meeting_no} courseName={selectedCourse.name} classLabel={selectedCourse.class_name} /></div>}

            <div className="admin-actions" style={{ marginBottom: 12 }}>
              <button className="btn btn-success" onClick={() => { const next: Record<string, StatusValue> = {}; courseStudents.forEach((student) => next[student.id] = "H"); setAttendanceDraft(next); }}>Semua Hadir</button>
              <button className="btn btn-secondary" onClick={() => { const next: Record<string, StatusValue> = {}; courseStudents.forEach((student) => next[student.id] = ""); setAttendanceDraft(next); }}>Kosongkan</button>
              <button className="btn btn-primary" disabled={saving || !selectedMeetingId} onClick={saveAttendance}>{saving ? "Menyimpan..." : "Simpan Absensi"}</button>
            </div>

            <div className="table-wrap"><table className="admin-table"><thead><tr><th>No</th><th>NPM</th><th>Nama</th><th>Status</th></tr></thead><tbody>{courseStudents.map((student, index) => <tr key={student.id}><td>{index + 1}</td><td>{student.npm}</td><td><strong>{student.name}</strong></td><td><select className="status-select" value={attendanceDraft[student.id] ?? ""} onChange={(e) => setAttendanceDraft((current) => ({ ...current, [student.id]: e.target.value as StatusValue }))}><option value="">— Belum diisi —</option>{(Object.keys(STATUS_LABELS) as AttendanceStatus[]).map((status) => <option key={status} value={status}>{status} — {STATUS_LABELS[status]}</option>)}</select></td></tr>)}</tbody></table></div>
          </div>
        </section>}

        {tab === "schedule" && <section className="panel">
          <div className="panel-head"><div><h2>Jadwal Asistensi</h2><p>Jadwal mingguan hasil import Excel.</p></div><button className="btn btn-secondary" onClick={() => setTab("import")}>Import Excel</button></div>
          <div className="panel-body">
            <div className="inline-form" style={{ marginBottom: 16 }}><div className="field"><label>Buat Rekap Bulan</label><input className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div><button className="btn btn-primary" onClick={generateMonth} disabled={saving}>{saving ? "Membuat..." : "Generate Rekap dari Jadwal"}</button></div>
            <div className="table-wrap"><table className="admin-table"><thead><tr><th>Hari</th><th>Jam</th><th>Kelas</th><th>Mata Kuliah</th><th>Dosen</th><th>Ruang</th><th>Link DB</th></tr></thead><tbody>{schedules.map((schedule) => <tr key={schedule.id}><td>{schedule.day_name}</td><td>{schedule.start_time.slice(0,5)}–{schedule.end_time.slice(0,5)}</td><td>{schedule.class_label}</td><td><strong>{schedule.course_name}</strong></td><td>{schedule.lecturer_name}</td><td>{schedule.room || "—"}</td><td><span className={`badge ${schedule.course_id ? "good" : "warn"}`}>{schedule.course_id ? "Terhubung" : "Belum cocok"}</span></td></tr>)}</tbody></table>{schedules.length === 0 && <div className="empty-state">Belum ada jadwal. Gunakan Import Excel.</div>}</div>
          </div>
        </section>}

        {tab === "recap" && <section className="panel">
          <div className="panel-head"><div><h2>Rekap Kehadiran Asdos</h2><p>Lengkapi materi dan keterangan, lalu print sesuai template kampus.</p></div><div className="admin-actions"><input className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} /><Link className="btn btn-primary" href={`/asdos/print?month=${month}`} target="_blank">🖨 Print Rekap</Link></div></div>
          <div className="panel-body">
            <div className="assessment-manager" style={{ marginBottom: 18 }}>
              <h3 style={{ marginTop: 0 }}>Tambah Kegiatan Manual</h3>
              <div className="form-grid-3">
                <div className="field"><label>Mata Kuliah</label><select className="select" value={manual.course_id} onChange={(e) => setManual({ ...manual, course_id: e.target.value })}><option value="">— Pilih —</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.name} — {course.class_name}</option>)}</select></div>
                <div className="field"><label>Tanggal</label><input className="input" type="date" value={manual.activity_date} onChange={(e) => setManual({ ...manual, activity_date: e.target.value })} /></div>
                <div className="field"><label>Ruang</label><input className="input" value={manual.room} onChange={(e) => setManual({ ...manual, room: e.target.value })} /></div>
                <div className="field"><label>Jam Mulai</label><input className="input" type="time" value={manual.start_time} onChange={(e) => setManual({ ...manual, start_time: e.target.value })} /></div>
                <div className="field"><label>Jam Selesai</label><input className="input" type="time" value={manual.end_time} onChange={(e) => setManual({ ...manual, end_time: e.target.value })} /></div>
                <div className="field"><label>Jenis Kegiatan</label><select className="select" value={manual.activity_type} onChange={(e) => setManual({ ...manual, activity_type: e.target.value })}><option>Mengajar</option><option>Mendampingi Praktikum</option><option>Menggantikan Dosen</option><option>Asistensi</option><option>Pengawasan</option><option>Lainnya</option></select></div>
                <div className="field"><label>Materi</label><input className="input" value={manual.material} onChange={(e) => setManual({ ...manual, material: e.target.value })} /></div>
                <div className="field"><label>Keterangan</label><input className="input" value={manual.notes} onChange={(e) => setManual({ ...manual, notes: e.target.value })} /></div>
                <div className="field"><label>&nbsp;</label><button className="btn btn-secondary" onClick={addManualLog}>+ Tambah Kegiatan</button></div>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}><strong>{monthLabel(month)}</strong> · {monthLogs.length} kegiatan · {(totalMinutes / 60).toFixed(totalMinutes % 60 ? 1 : 0)} jam</div>
            <div className="table-wrap"><table className="admin-table"><thead><tr><th>No</th><th>Tanggal/Jam</th><th>Kelas & MK</th><th>Ruang</th><th>Materi</th><th>Kegiatan</th><th>Keterangan</th><th>Aksi</th></tr></thead><tbody>{monthLogs.map((log, index) => <tr key={log.id}><td>{index + 1}</td><td>{log.activity_date}<br/><small>{log.start_time.slice(0,5)}–{log.end_time.slice(0,5)}</small></td><td><strong>{log.course_name}</strong><br/><small>{log.class_label} · {log.lecturer_name}</small></td><td><input className="input" style={{ minWidth: 110 }} value={log.room} onChange={(e) => setLogs((items) => items.map((item) => item.id === log.id ? { ...item, room: e.target.value } : item))} /></td><td><input className="input" style={{ minWidth: 150 }} value={log.material} onChange={(e) => setLogs((items) => items.map((item) => item.id === log.id ? { ...item, material: e.target.value } : item))} /></td><td><select className="select" value={log.activity_type} onChange={(e) => setLogs((items) => items.map((item) => item.id === log.id ? { ...item, activity_type: e.target.value } : item))}><option>Mengajar</option><option>Mendampingi Praktikum</option><option>Menggantikan Dosen</option><option>Asistensi</option><option>Pengawasan</option><option>Lainnya</option></select></td><td><input className="input" style={{ minWidth: 140 }} value={log.notes} onChange={(e) => setLogs((items) => items.map((item) => item.id === log.id ? { ...item, notes: e.target.value } : item))} /></td><td><div className="admin-actions"><button className="btn btn-secondary btn-small" onClick={() => saveLog(log)}>Simpan</button><button className="btn btn-danger btn-small" onClick={() => deleteLog(log.id)}>Hapus</button></div></td></tr>)}</tbody></table>{monthLogs.length === 0 && <div className="empty-state">Belum ada rekap bulan ini. Generate dari Jadwal Asistensi atau tambah manual.</div>}</div>
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
