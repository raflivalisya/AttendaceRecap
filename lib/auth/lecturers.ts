export type LecturerAccount = {
  user_id: string;
  email: string;
  display_name: string;
  role: "lecturer" | "assistant";
  course_count: number;
  course_ids: string[];
};
