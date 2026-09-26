export type AssistantProfile = {
  user_id: string;
  username: string;
  full_name: string;
  npm: string | null;
  program_study: string | null;
  is_active: boolean;
};

export type AssistantDirectoryItem = {
  user_id: string;
  username: string;
  full_name: string;
  npm: string | null;
  program_study: string | null;
  is_active: boolean;
};

export type AssistantScheduleTemplate = {
  id: string;
  assistant_user_id: string;
  course_id: string | null;
  weekday: number;
  day_name: string;
  start_time: string;
  end_time: string;
  class_label: string;
  course_name: string;
  lecturer_name: string;
  room: string;
  source_filename: string | null;
  source_sheet: string | null;
  created_at: string;
};

export type AssistantActivityLog = {
  id: string;
  assistant_user_id: string;
  schedule_template_id: string | null;
  course_id: string | null;
  activity_date: string;
  start_time: string;
  end_time: string;
  class_label: string;
  room: string;
  course_name: string;
  material: string;
  lecturer_name: string;
  activity_type: string;
  notes: string;
  status: "draft" | "submitted" | "approved" | "rejected";
  created_at: string;
  updated_at: string;
};

export type ParsedAssistantSchedule = {
  weekday: number;
  day_name: string;
  start_time: string;
  end_time: string;
  class_label: string;
  course_name: string;
  lecturer_name: string;
  room: string;
  matched_course_id: string | null;
  matched_course_label: string | null;
  match_status: "matched" | "unmatched";
  source_sheet: string;
};


export type CourseScheduleSlot = {
  id: string;
  course_id: string;
  weekday: number;
  day_name: string;
  start_time: string;
  end_time: string;
  room: string;
  source_filename: string | null;
  source_assistant_user_id: string | null;
  created_at?: string;
  updated_at?: string;
};
