"use client";

import { useMemo } from "react";
import type { Assessment, Attendance, Course, Meeting, Student } from "@/lib/types";

type Tab = "attendance" | "grades" | "students" | "settings";

type Props = {
  courses: Course[];
  students: Student[];
  meetings: Meeting[];
  attendance: Attendance[];
  assessments: Assessment[];
  onOpen: (courseId: string, tab: Tab) => void;
};

type WarningItem = {
  id: string;
  courseId: string;
  tab: Tab;
  severity: "high" | "medium" | "info";
  title: string;
  body: string;
};

export default function AutoWarningCenter({
  courses,
  students,
  meetings,
  attendance,
  assessments,
  onOpen,
}: Props) {
  const warnings = useMemo<WarningItem[]>(() => {
    const result: WarningItem[] = [];
    const today = new Date().toISOString().slice(0, 10);

    for (const course of courses) {
      if (!String(course.schedule ?? "").trim()) {
        result.push({
          id: `schedule-${course.id}`,
          courseId: course.id,
          tab: "settings",
          severity: "medium",
          title: "Jadwal belum lengkap",
          body: `${course.name} — ${course.class_name} belum memiliki ringkasan jadwal.`,
        });
      }

      const courseAssessments = assessments.filter((item) => item.course_id === course.id);
      const weight = courseAssessments.reduce((sum, item) => sum + Number(item.weight), 0);
      if (weight !== 100) {
        result.push({
          id: `weight-${course.id}`,
          courseId: course.id,
          tab: "grades",
          severity: "medium",
          title: `Bobot nilai baru ${weight}%`,
          body: `${course.name} — ${course.class_name} sebaiknya memiliki total bobot 100%.`,
        });
      }

      const courseMeetings = meetings.filter((item) => item.course_id === course.id);
      const overdueWithoutAttendance = courseMeetings.filter((meeting) => {
        if (meeting.meeting_date > today) return false;
        return !attendance.some((row) => row.meeting_id === meeting.id);
      });

      if (overdueWithoutAttendance.length) {
        const first = overdueWithoutAttendance[0];
        result.push({
          id: `missing-attendance-${course.id}`,
          courseId: course.id,
          tab: "attendance",
          severity: "high",
          title: `${overdueWithoutAttendance.length} pertemuan belum punya absensi`,
          body: `${course.name} — ${course.class_name}; mulai dari P${first.meeting_no}.`,
        });
      }

      const courseStudents = students.filter((item) => item.course_id === course.id);
      const heldIds = new Set(
        attendance
          .filter((row) => courseMeetings.some((meeting) => meeting.id === row.meeting_id))
          .map((row) => row.meeting_id),
      );

      if (heldIds.size) {
        let underMinimum = 0;

        for (const student of courseStudents) {
          let present = 0;
          for (const meetingId of heldIds) {
            const row = attendance.find(
              (item) => item.meeting_id === meetingId && item.student_id === student.id,
            );
            if (row?.status === "H") present += 1;
          }

          const percentage = Math.round((present / heldIds.size) * 100);
          if (percentage < Number(course.min_attendance_pct)) underMinimum += 1;
        }

        if (underMinimum) {
          result.push({
            id: `low-attendance-${course.id}`,
            courseId: course.id,
            tab: "attendance",
            severity: "high",
            title: `${underMinimum} mahasiswa di bawah batas kehadiran`,
            body: `${course.name} — ${course.class_name}; batas minimal ${course.min_attendance_pct}%.`,
          });
        }
      }

      if (!course.publish_grades && courseAssessments.length) {
        result.push({
          id: `unpublished-${course.id}`,
          courseId: course.id,
          tab: "grades",
          severity: "info",
          title: "Nilai belum dipublikasikan",
          body: `${course.name} — ${course.class_name} masih menyimpan nilai sebagai data internal.`,
        });
      }
    }

    return result;
  }, [courses, students, meetings, attendance, assessments]);

  return (
    <section className="panel academic-warning-panel">
      <div className="panel-head">
        <div>
          <h2>Auto Warning</h2>
          <p>Sistem menandai data yang perlu perhatian tanpa mengubah data secara otomatis.</p>
        </div>
        <span className={`badge ${warnings.some((item) => item.severity === "high") ? "warn" : "good"}`}>
          {warnings.length} perhatian
        </span>
      </div>

      <div className="panel-body">
        {warnings.length ? (
          <div className="academic-warning-grid">
            {warnings.slice(0, 12).map((item) => (
              <button
                type="button"
                key={item.id}
                className={`academic-warning-card severity-${item.severity}`}
                onClick={() => onOpen(item.courseId, item.tab)}
              >
                <span className="academic-warning-dot" />
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.body}</small>
                </span>
                <b>›</b>
              </button>
            ))}
          </div>
        ) : (
          <div className="academic-all-good">
            <span>✓</span>
            <div>
              <strong>Tidak ada warning utama</strong>
              <small>Jadwal, bobot, absensi, dan batas kehadiran terlihat normal.</small>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
