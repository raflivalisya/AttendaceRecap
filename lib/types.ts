export type AttendanceStatus = "H" | "I" | "S" | "A";

export type Course = {
  id: string;
  name: string;
  class_name: string;
  lecturer: string;
  schedule: string;
  semester: string;
  academic_year: string;
  min_attendance_pct: number;
  meeting_count: number;
  publish_grades: boolean;
  created_at?: string;
};

export type Student = {
  id: string;
  course_id: string;
  npm: string;
  name: string;
};

export type Meeting = {
  id: string;
  course_id: string;
  meeting_no: number;
  meeting_date: string;
};

export type Attendance = {
  id: string;
  meeting_id: string;
  student_id: string;
  status: AttendanceStatus;
};

export type Assessment = {
  id: string;
  course_id: string;
  name: string;
  category: string;
  max_score: number;
  weight: number;
  sort_order: number;
};

export type Grade = {
  id: string;
  assessment_id: string;
  student_id: string;
  score: number;
};
