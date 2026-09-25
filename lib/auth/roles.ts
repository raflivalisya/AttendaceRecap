export type AppRole =
  | "super_admin"
  | "lecturer"
  | "assistant";

export type CourseRole =
  | "lecturer"
  | "assistant";

export type AdminProfile = {
  user_id: string;
  display_name: string | null;
  role: AppRole;
};

export type CourseMembership = {
  id: string;
  course_id: string;
  user_id: string;
  role: CourseRole;
  created_at: string;
};

export const ROLE_LABEL: Record<
  AppRole,
  string
> = {
  super_admin:
    "Super Admin",

  lecturer:
    "Dosen",

  assistant:
    "Asisten Dosen",
};

export function isSuperAdmin(
  role?: AppRole | null
) {
  return (
    role ===
    "super_admin"
  );
}

export function canManageGrades(
  role?: AppRole | null
) {
  return (
    role ===
      "super_admin" ||
    role ===
      "lecturer"
  );
}

export function canManageAttendance(
  role?: AppRole | null
) {
  return (
    role ===
      "super_admin" ||
    role ===
      "lecturer" ||
    role ===
      "assistant"
  );
}