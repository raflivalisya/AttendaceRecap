import type { Attendance, AttendanceStatus, Meeting, Student } from "./types";

export const STATUS_LABELS: Record<AttendanceStatus, string> = {
  H: "Hadir",
  I: "Izin",
  S: "Sakit",
  A: "Alfa",
};

export function buildAttendanceMap(attendance: Attendance[]) {
  const map = new Map<string, AttendanceStatus>();
  attendance.forEach((item) => {
    map.set(`${item.meeting_id}:${item.student_id}`, item.status);
  });
  return map;
}

export function getHeldMeetingIds(attendance: Attendance[]) {
  return new Set(attendance.map((item) => item.meeting_id));
}

export function getStudentRecap(
  student: Student,
  meetings: Meeting[],
  attendanceMap: Map<string, AttendanceStatus>,
  heldMeetingIds: Set<string>,
) {
  const counts = { H: 0, I: 0, S: 0, A: 0 };

  meetings.forEach((meeting) => {
    const status = attendanceMap.get(`${meeting.id}:${student.id}`);
    if (status) counts[status] += 1;
  });

  const held = heldMeetingIds.size;
  const percentage = held > 0 ? Math.round((counts.H / held) * 100) : 0;

  return { ...counts, held, percentage };
}

export function formatShortDate(date: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(`${date}T00:00:00`));
}

export function formatLongDate(date: string) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}
