"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AppRole, CourseRole } from "@/lib/auth/roles";

type MembershipMap = Record<string, CourseRole>;

type AccessState = {
  loading: boolean;
  error: string;
  userId: string;
  displayName: string;
  profileRole: AppRole | null;
  memberships: MembershipMap;
};

export function useAdminAccess() {
  const supabase = useMemo(() => createClient(), []);

  const [state, setState] = useState<AccessState>({
    loading: true,
    error: "",
    userId: "",
    displayName: "",
    profileRole: null,
    memberships: {},
  });

  useEffect(() => {
    let cancelled = false;

    async function loadAccess() {
      try {
        setState((current) => ({ ...current, loading: true, error: "" }));

        const {
          data: userData,
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) throw userError;

        const user = userData.user;
        if (!user) throw new Error("User belum login.");

        const { data: profile, error: profileError } = await supabase
          .from("admin_profiles")
          .select("user_id, display_name, role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileError) throw profileError;
        if (!profile) {
          throw new Error("Profil pengguna tidak ditemukan di admin_profiles.");
        }

        const profileRole = profile.role as AppRole;

        if (profileRole === "super_admin") {
          if (!cancelled) {
            setState({
              loading: false,
              error: "",
              userId: user.id,
              displayName:
                profile.display_name ?? user.email ?? "Super Admin",
              profileRole: "super_admin",
              memberships: {},
            });
          }
          return;
        }

        const { data: membershipRows, error: membershipError } = await supabase
          .from("course_members")
          .select("course_id, role")
          .eq("user_id", user.id);

        if (membershipError) throw membershipError;

        const memberships: MembershipMap = {};
        for (const row of membershipRows ?? []) {
          memberships[row.course_id] = row.role as CourseRole;
        }

        if (!cancelled) {
          setState({
            loading: false,
            error: "",
            userId: user.id,
            displayName: profile.display_name ?? user.email ?? "Pengguna",
            profileRole,
            memberships,
          });
        }
      } catch (error: any) {
        console.error("LOAD ACCESS ERROR:", error);
        if (!cancelled) {
          setState((current) => ({
            ...current,
            loading: false,
            error: error?.message || "Gagal membaca hak akses.",
          }));
        }
      }
    }

    void loadAccess();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const isSuperAdmin = state.profileRole === "super_admin";

  const getCourseRole = useCallback(
    (courseId: string): CourseRole | "super_admin" | null => {
      if (isSuperAdmin) return "super_admin";
      return state.memberships[courseId] ?? null;
    },
    [isSuperAdmin, state.memberships],
  );

  const canSeeCourse = useCallback(
    (courseId: string) => {
      if (isSuperAdmin) return true;
      return Boolean(state.memberships[courseId]);
    },
    [isSuperAdmin, state.memberships],
  );

  const canEditCourse = useCallback(
    (courseId: string) => {
      const role = getCourseRole(courseId);
      return role === "super_admin" || role === "lecturer";
    },
    [getCourseRole],
  );

  const canManageStudents = useCallback(
    (courseId: string) => {
      const role = getCourseRole(courseId);
      return role === "super_admin" || role === "lecturer";
    },
    [getCourseRole],
  );

  const canManageAttendance = useCallback(
    (courseId: string) => {
      const role = getCourseRole(courseId);
      return (
        role === "super_admin" ||
        role === "lecturer" ||
        role === "assistant"
      );
    },
    [getCourseRole],
  );

  const canManageGrades = useCallback(
    (courseId: string) => {
      const role = getCourseRole(courseId);
      return role === "super_admin" || role === "lecturer";
    },
    [getCourseRole],
  );

  return {
    ...state,
    isSuperAdmin,
    getCourseRole,
    canSeeCourse,
    canEditCourse,
    canManageStudents,
    canManageAttendance,
    canManageGrades,
    canCreateCourse: isSuperAdmin,
    canDeleteCourse: isSuperAdmin,
  };
}
