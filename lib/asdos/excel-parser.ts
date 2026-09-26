import * as XLSX from "xlsx";
import type { ParsedAssistantSchedule } from "@/lib/asdos/types";

type CourseCandidate = {
  id: string;
  name: string;
  class_name: string;
  lecturer?: string | null;
};

const DAY_MAP: Record<string, number> = {
  senin: 1,
  selasa: 2,
  rabu: 3,
  kamis: 4,
  jumat: 5,
  sabtu: 6,
};

function clean(value: unknown) {
  return String(value ?? "").replace(/\r/g, "").trim();
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/\(praktikum\)/g, "")
    .replace(/\bpraktikum\b/g, "")
    .replace(/\bgel\.?\s*\d+\b/g, "")
    .replace(/[-–—]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePersonName(value: string) {
  return value
    .toLowerCase()
    .replace(/\b(dr|drsc|s\.?kom|m\.?kom|m\.?cs|s\.?t|m\.?t|m\.?eng|m\.?ti|bmm|mit|cdsp|instruktur)\b\.?/gi, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTime(value: string) {
  const match = value.match(/^(\d{1,2})[.:](\d{2})$/);
  if (!match) return null;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function addTwoHours(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  const total = hour * 60 + minute + 120;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function looksLikeRoom(line: string) {
  return /\b(lab|laboratorium|ruang|kelas)\b/i.test(line);
}

function looksLikeLecturer(line: string) {
  return /\b(dr\.?|s\.?kom|m\.?kom|m\.?cs|s\.?t|m\.?t|m\.?eng|m\.?ti|bmm|mit|cdsp|instruktur)\b/i.test(line);
}

function parseScheduleCell(raw: string) {
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return null;

  const classLabel = lines[0];
  const roomIndex = lines.findIndex((line, index) => index > 0 && looksLikeRoom(line));
  const room = roomIndex >= 0 ? lines[roomIndex] : "";
  const middle = lines.slice(1).filter((_, index) => index + 1 !== roomIndex);

  let lecturerName = "";
  let courseName = "";

  const lecturerIndex = middle.findIndex(looksLikeLecturer);
  if (lecturerIndex >= 0) {
    lecturerName = middle[lecturerIndex];
    courseName = middle.filter((_, index) => index !== lecturerIndex).join(" ");
  } else if (middle.length >= 2) {
    courseName = middle[0];
    lecturerName = middle.slice(1).join(" ");
  } else {
    courseName = middle[0] ?? "";
  }

  return { classLabel, courseName, lecturerName, room };
}

function scoreCourse(entry: { classLabel: string; courseName: string }, course: CourseCandidate) {
  const excelClass = normalize(entry.classLabel);
  const dbClass = normalize(course.class_name);
  const excelCourse = normalize(entry.courseName);
  const dbCourse = normalize(course.name);

  let score = 0;
  if (excelClass && dbClass && excelClass === dbClass) score += 6;
  else if (excelClass && dbClass && (excelClass.includes(dbClass) || dbClass.includes(excelClass))) score += 4;

  if (excelCourse && dbCourse && excelCourse === dbCourse) score += 6;
  else if (excelCourse && dbCourse && (excelCourse.includes(dbCourse) || dbCourse.includes(excelCourse))) score += 4;

  return score;
}

function matchCourse(entry: { classLabel: string; courseName: string }, courses: CourseCandidate[]) {
  const ranked = courses
    .map((course) => ({ course, score: scoreCourse(entry, course) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || best.score < 8) return null;
  if (ranked[1] && ranked[1].score === best.score) return null;
  return best.course;
}

export function parseAssistantWorkbook(
  buffer: Buffer,
  assistantFullName: string,
  courses: CourseCandidate[],
): { entries: ParsedAssistantSchedule[]; availableNames: string[] } {
  const workbook = XLSX.read(buffer, { type: "buffer", cellText: true });
  const wantedName = normalizePersonName(assistantFullName);
  const availableNames: string[] = [];
  const entries: ParsedAssistantSchedule[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      raw: false,
      defval: "",
    });

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const firstCell = clean(rows[rowIndex]?.[0]);
      if (!/^nama\s*:/i.test(firstCell)) continue;

      const fullName = firstCell.replace(/^nama\s*:/i, "").trim();
      if (fullName) availableNames.push(fullName);
      if (normalizePersonName(fullName) !== wantedName) continue;

      let dayHeaderIndex = -1;
      for (let scan = rowIndex + 1; scan < Math.min(rows.length, rowIndex + 8); scan += 1) {
        const joined = (rows[scan] ?? []).map(clean).join(" ").toLowerCase();
        if (joined.includes("senin") && joined.includes("sabtu")) {
          dayHeaderIndex = scan;
          break;
        }
      }
      if (dayHeaderIndex < 0) continue;

      const header = rows[dayHeaderIndex] ?? [];
      const dayColumns: Array<{ column: number; dayName: string; weekday: number }> = [];
      header.forEach((value, column) => {
        const dayName = clean(value).toLowerCase();
        if (DAY_MAP[dayName]) {
          dayColumns.push({
            column,
            dayName: dayName.charAt(0).toUpperCase() + dayName.slice(1),
            weekday: DAY_MAP[dayName],
          });
        }
      });

      const timeRows: Array<{ row: number; time: string }> = [];
      for (let scan = dayHeaderIndex + 1; scan < rows.length; scan += 1) {
        const nextFirst = clean(rows[scan]?.[0]);
        if (/^nama\s*:/i.test(nextFirst)) break;
        const parsedTime = parseTime(nextFirst);
        if (parsedTime) timeRows.push({ row: scan, time: parsedTime });
        if (scan > dayHeaderIndex + 20 && !nextFirst && !(rows[scan] ?? []).some((cell) => clean(cell))) break;
      }

      for (let timeIndex = 0; timeIndex < timeRows.length; timeIndex += 1) {
        const current = timeRows[timeIndex];
        const nextTime = timeRows[timeIndex + 1]?.time ?? addTwoHours(current.time);
        const row = rows[current.row] ?? [];

        for (const dayColumn of dayColumns) {
          const raw = clean(row[dayColumn.column]);
          if (!raw) continue;
          const parsed = parseScheduleCell(raw);
          if (!parsed) continue;

          const matched = matchCourse(parsed, courses);
          entries.push({
            weekday: dayColumn.weekday,
            day_name: dayColumn.dayName,
            start_time: current.time,
            end_time: nextTime,
            class_label: parsed.classLabel,
            course_name: parsed.courseName,
            lecturer_name: parsed.lecturerName,
            room: parsed.room,
            matched_course_id: matched?.id ?? null,
            matched_course_label: matched ? `${matched.name} — ${matched.class_name}` : null,
            match_status: matched ? "matched" : "unmatched",
            source_sheet: sheetName,
          });
        }
      }
    }
  }

  return {
    entries,
    availableNames: Array.from(new Set(availableNames)),
  };
}
