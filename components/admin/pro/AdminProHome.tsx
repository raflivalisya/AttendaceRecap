"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  Assessment,
  Attendance,
  Course,
  Grade,
  Meeting,
  Student,
} from "@/lib/types";

type Tab = "attendance" | "grades" | "students" | "settings";

type Props = {
  courses: Course[];
  students: Student[];
  meetings: Meeting[];
  attendance: Attendance[];
  assessments: Assessment[];
  grades: Grade[];
  selectedCourseId: string;
  canCreateCourse: boolean;
  onSelectCourse: (courseId: string, tab: Tab) => void;
  onCreateCourse: () => void;
};

type CourseSchedule = {
  id: string;
  course_id: string;
  weekday: number;
  day_name: string;
  start_time: string;
  end_time: string;
  room: string | null;
};

const DAY_NAMES = [
  "",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
  "Minggu",
];

function isoWeekday(value: Date) {
  const day = value.getDay();
  return day === 0 ? 7 : day;
}

function cleanTime(value?: string | null) {
  if (!value) return "";
  return value.slice(0, 5);
}

function formatToday() {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

export default function AdminProHome({
  courses,
  students,
  meetings,
  attendance,
  assessments,
  grades,
  selectedCourseId,
  canCreateCourse,
  onSelectCourse,
  onCreateCourse,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [schedules, setSchedules] = useState<CourseSchedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadSchedules() {
      if (!courses.length) {
        setSchedules([]);
        setLoadingSchedules(false);
        return;
      }

      setLoadingSchedules(true);

      const { data, error } = await supabase
        .from("course_schedules")
        .select(
          "id, course_id, weekday, day_name, start_time, end_time, room",
        )
        .in(
          "course_id",
          courses.map((course) => course.id),
        )
        .order("weekday")
        .order("start_time");

      if (!cancelled) {
        if (error) {
          // Fallback ke courses.schedule di bawah.
          setSchedules([]);
        } else {
          setSchedules((data ?? []) as CourseSchedule[]);
        }

        setLoadingSchedules(false);
      }
    }

    void loadSchedules();

    return () => {
      cancelled = true;
    };
  }, [courses, supabase]);

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const weekday = isoWeekday(today);
  const todayName = DAY_NAMES[weekday];

  const todaysClasses = useMemo(() => {
    if (schedules.length) {
      return schedules
        .filter((slot) => Number(slot.weekday) === weekday)
        .map((slot) => {
          const course = courses.find((item) => item.id === slot.course_id);

          return {
            course,
            courseId: slot.course_id,
            dayName: slot.day_name,
            start: cleanTime(slot.start_time),
            end: cleanTime(slot.end_time),
            room: slot.room ?? "",
          };
        })
        .filter((item) => Boolean(item.course))
        .sort((a, b) => a.start.localeCompare(b.start));
    }

    // Fallback untuk project yang belum punya course_schedules.
    return courses
      .filter((course) =>
        String(course.schedule ?? "")
          .toLowerCase()
          .includes(todayName.toLowerCase()),
      )
      .map((course) => {
        const schedule = String(course.schedule ?? "");
        const match = schedule.match(
          /(\d{1,2}[:.]\d{2})\s*[-–—]\s*(\d{1,2}[:.]\d{2})/,
        );

        return {
          course,
          courseId: course.id,
          dayName: todayName,
          start: match?.[1]?.replace(".", ":") ?? "",
          end: match?.[2]?.replace(".", ":") ?? "",
          room: "",
        };
      });
  }, [courses, schedules, todayName, weekday]);

  const meetingIdsToday = useMemo(
    () =>
      new Set(
        meetings
          .filter((meeting) => meeting.meeting_date === todayIso)
          .map((meeting) => meeting.id),
      ),
    [meetings, todayIso],
  );

  const attendanceToday = attendance.filter((row) =>
    meetingIdsToday.has(row.meeting_id),
  ).length;

  const incompleteWeights = useMemo(() => {
    return courses.filter((course) => {
      const total = assessments
        .filter((item) => item.course_id === course.id)
        .reduce((sum, item) => sum + Number(item.weight), 0);

      return total !== 100;
    }).length;
  }, [courses, assessments]);

  const totalPublishedCourses = courses.filter(
    (course) => course.publish_grades,
  ).length;

  const selectedCourse =
    courses.find((course) => course.id === selectedCourseId) ?? courses[0];

  const courseCards = useMemo(() => {
    return courses
      .map((course) => {
        const courseMeetingIds = new Set(
          meetings
            .filter((meeting) => meeting.course_id === course.id)
            .map((meeting) => meeting.id),
        );

        const heldMeetingIds = new Set(
          attendance
            .filter((row) => courseMeetingIds.has(row.meeting_id))
            .map((row) => row.meeting_id),
        );

        const totalMeetings =
          meetings.filter((meeting) => meeting.course_id === course.id).length ||
          Number(course.meeting_count) ||
          16;

        const studentCount = students.filter(
          (student) => student.course_id === course.id,
        ).length;

        return {
          course,
          held: heldMeetingIds.size,
          total: totalMeetings,
          studentCount,
        };
      })
      .sort((a, b) => a.course.name.localeCompare(b.course.name, "id"));
  }, [courses, meetings, attendance, students]);

  return (
    <div className="admin-pro-home">
      <section className="admin-pro-welcome">
        <div>
          <span className="admin-pro-kicker">BERANDA AKADEMIK</span>
          <h2>Selamat datang kembali</h2>
          <p>
            {formatToday()} · Lihat kelas hari ini, progres perkuliahan, dan
            akses cepat ke pekerjaan yang paling sering digunakan.
          </p>
        </div>

        <div className="admin-pro-welcome-actions">
          {selectedCourse && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onSelectCourse(selectedCourse.id, "attendance")}
            >
              Buka Kelas Aktif
            </button>
          )}

          {canCreateCourse && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onCreateCourse}
            >
              + Mata Kuliah Baru
            </button>
          )}
        </div>
      </section>

      <div className="admin-pro-stat-grid">
        <div className="admin-pro-stat-card">
          <span className="admin-pro-stat-icon">📚</span>
          <div>
            <strong>{courses.length}</strong>
            <span>Kelas aktif</span>
          </div>
        </div>

        <div className="admin-pro-stat-card">
          <span className="admin-pro-stat-icon">👥</span>
          <div>
            <strong>{students.length}</strong>
            <span>Mahasiswa</span>
          </div>
        </div>

        <div className="admin-pro-stat-card">
          <span className="admin-pro-stat-icon">🗓️</span>
          <div>
            <strong>{todaysClasses.length}</strong>
            <span>Kelas hari ini</span>
          </div>
        </div>

        <div className="admin-pro-stat-card">
          <span className="admin-pro-stat-icon">✅</span>
          <div>
            <strong>{attendanceToday}</strong>
            <span>Presensi tercatat hari ini</span>
          </div>
        </div>

        <div className="admin-pro-stat-card">
          <span className="admin-pro-stat-icon">⚠️</span>
          <div>
            <strong>{incompleteWeights}</strong>
            <span>Bobot nilai perlu dicek</span>
          </div>
        </div>

        <div className="admin-pro-stat-card">
          <span className="admin-pro-stat-icon">🌐</span>
          <div>
            <strong>{totalPublishedCourses}</strong>
            <span>Kelas publikasi nilai aktif</span>
          </div>
        </div>
      </div>

      <div className="admin-pro-home-grid">
        <section className="panel admin-pro-today-panel">
          <div className="panel-head">
            <div>
              <h2>Kelas Hari Ini</h2>
              <p>
                {loadingSchedules
                  ? "Memuat jadwal..."
                  : `${todayName} · ${todaysClasses.length} jadwal`}
              </p>
            </div>

            <span className="badge neutral">{todayName}</span>
          </div>

          <div className="panel-body">
            {todaysClasses.length ? (
              <div className="admin-pro-today-list">
                {todaysClasses.map((item, index) => (
                  <article
                    className="admin-pro-today-item"
                    key={`${item.courseId}-${item.start}-${index}`}
                  >
                    <div className="admin-pro-time">
                      <strong>{item.start || "—"}</strong>
                      <span>{item.end ? `– ${item.end}` : ""}</span>
                    </div>

                    <div className="admin-pro-today-main">
                      <strong>{item.course!.name}</strong>
                      <span>
                        {item.course!.class_name}
                        {item.room ? ` · ${item.room}` : ""}
                      </span>
                      <small>{item.course!.lecturer}</small>
                    </div>

                    <div className="admin-pro-today-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-small"
                        onClick={() =>
                          onSelectCourse(item.courseId, "attendance")
                        }
                      >
                        Absensi
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary btn-small"
                        onClick={() =>
                          onSelectCourse(item.courseId, "students")
                        }
                      >
                        Mahasiswa
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="admin-pro-empty">
                <span>☕</span>
                <strong>Tidak ada kelas terjadwal hari ini</strong>
                <p>
                  Gunakan Kelola Kelas jika ingin membuka mata kuliah lain.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="panel admin-pro-quick-panel">
          <div className="panel-head">
            <div>
              <h2>Akses Cepat</h2>
              <p>
                {selectedCourse
                  ? `${selectedCourse.name} · ${selectedCourse.class_name}`
                  : "Pilih kelas dari daftar"}
              </p>
            </div>
          </div>

          <div className="panel-body">
            {selectedCourse ? (
              <div className="admin-pro-quick-grid">
                <button
                  type="button"
                  onClick={() =>
                    onSelectCourse(selectedCourse.id, "attendance")
                  }
                >
                  <span>📝</span>
                  <strong>Absensi</strong>
                  <small>Input & QR</small>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectCourse(selectedCourse.id, "grades")}
                >
                  <span>📊</span>
                  <strong>Nilai</strong>
                  <small>Komponen & skor</small>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectCourse(selectedCourse.id, "students")}
                >
                  <span>👨‍🎓</span>
                  <strong>Mahasiswa</strong>
                  <small>Tambah & kelola</small>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectCourse(selectedCourse.id, "settings")}
                >
                  <span>⚙️</span>
                  <strong>Pengaturan</strong>
                  <small>Jadwal & Asdos</small>
                </button>
              </div>
            ) : (
              <div className="admin-pro-empty">
                <strong>Belum ada kelas aktif</strong>
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="panel admin-pro-progress-panel">
        <div className="panel-head">
          <div>
            <h2>Progres Mata Kuliah</h2>
            <p>Ringkasan pertemuan dan jumlah mahasiswa per kelas.</p>
          </div>
        </div>

        <div className="panel-body">
          <div className="admin-pro-course-progress-grid">
            {courseCards.map(({ course, held, total, studentCount }) => {
              const percent = total
                ? Math.min(100, Math.round((held / total) * 100))
                : 0;

              return (
                <button
                  type="button"
                  className="admin-pro-course-progress"
                  key={course.id}
                  onClick={() => onSelectCourse(course.id, "attendance")}
                >
                  <div className="admin-pro-progress-head">
                    <div>
                      <strong>{course.name}</strong>
                      <span>{course.class_name}</span>
                    </div>

                    <span>{held}/{total}</span>
                  </div>

                  <div className="admin-pro-progress-track">
                    <span style={{ width: `${percent}%` }} />
                  </div>

                  <div className="admin-pro-progress-meta">
                    <span>{percent}% pertemuan</span>
                    <span>{studentCount} mahasiswa</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
