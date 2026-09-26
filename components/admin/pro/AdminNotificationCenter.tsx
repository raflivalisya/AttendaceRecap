"use client";

import { useMemo, useState } from "react";
import type {
  Assessment,
  Attendance,
  Course,
  Meeting,
} from "@/lib/types";

type Tab = "attendance" | "grades" | "students" | "settings";

type Props = {
  courses: Course[];
  meetings: Meeting[];
  attendance: Attendance[];
  assessments: Assessment[];
  onOpenCourse: (courseId: string, tab: Tab) => void;
};

type NotificationItem = {
  id: string;
  icon: string;
  title: string;
  body: string;
  courseId?: string;
  tab?: Tab;
  tone: "info" | "warning" | "success";
};

export default function AdminNotificationCenter({
  courses,
  meetings,
  attendance,
  assessments,
  onOpenCourse,
}: Props) {
  const [open, setOpen] = useState(false);

  const items = useMemo<NotificationItem[]>(() => {
    const today = new Date().toISOString().slice(0, 10);
    const result: NotificationItem[] = [];

    for (const course of courses) {
      if (!String(course.schedule ?? "").trim()) {
        result.push({
          id: `schedule-${course.id}`,
          icon: "🗓️",
          title: "Jadwal belum lengkap",
          body: `${course.name} — ${course.class_name} belum memiliki ringkasan jadwal.`,
          courseId: course.id,
          tab: "settings",
          tone: "warning",
        });
      }

      const totalWeight = assessments
        .filter((item) => item.course_id === course.id)
        .reduce((sum, item) => sum + Number(item.weight), 0);

      if (totalWeight !== 100) {
        result.push({
          id: `weight-${course.id}`,
          icon: "📊",
          title: `Bobot nilai ${totalWeight}%`,
          body: `${course.name} — ${course.class_name} belum memiliki total bobot 100%.`,
          courseId: course.id,
          tab: "grades",
          tone: "warning",
        });
      }
    }

    const todayMeetings = meetings.filter(
      (meeting) => meeting.meeting_date === today,
    );

    for (const meeting of todayMeetings) {
      const course = courses.find((item) => item.id === meeting.course_id);
      if (!course) continue;

      const hasAttendance = attendance.some(
        (row) => row.meeting_id === meeting.id,
      );

      result.push({
        id: `meeting-${meeting.id}`,
        icon: hasAttendance ? "✅" : "⏰",
        title: hasAttendance
          ? `Presensi P${meeting.meeting_no} sudah masuk`
          : `Presensi P${meeting.meeting_no} belum diisi`,
        body: `${course.name} — ${course.class_name} · hari ini`,
        courseId: course.id,
        tab: "attendance",
        tone: hasAttendance ? "success" : "info",
      });
    }

    if (!result.length) {
      result.push({
        id: "all-good",
        icon: "✨",
        title: "Tidak ada perhatian khusus",
        body: "Jadwal, presensi hari ini, dan bobot nilai terlihat normal.",
        tone: "success",
      });
    }

    return result.slice(0, 12);
  }, [courses, meetings, attendance, assessments]);

  const attentionCount = items.filter(
    (item) => item.tone === "warning" || item.tone === "info",
  ).length;

  return (
    <div className="admin-pro-notification-wrap">
      <button
        type="button"
        className="admin-pro-icon-action"
        onClick={() => setOpen((value) => !value)}
        title="Notifikasi"
      >
        🔔
        <span>Notifikasi</span>

        {attentionCount > 0 && (
          <b className="admin-pro-notification-count">{attentionCount}</b>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            className="admin-pro-popover-dismiss"
            aria-label="Tutup notifikasi"
            onClick={() => setOpen(false)}
          />

          <div className="admin-pro-notification-popover">
            <div className="admin-pro-notification-head">
              <div>
                <strong>Notifikasi</strong>
                <span>{items.length} informasi</span>
              </div>

              <button type="button" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>

            <div className="admin-pro-notification-list">
              {items.map((item) => (
                <button
                  type="button"
                  className={`tone-${item.tone}`}
                  key={item.id}
                  onClick={() => {
                    if (item.courseId && item.tab) {
                      onOpenCourse(item.courseId, item.tab);
                      setOpen(false);
                    }
                  }}
                  disabled={!item.courseId}
                >
                  <span className="admin-pro-notification-icon">
                    {item.icon}
                  </span>

                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.body}</small>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
