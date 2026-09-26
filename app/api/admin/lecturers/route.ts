import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function requireSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { success: false, message: "Anda belum login." },
        { status: 401 },
      ),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("admin_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError || profile?.role !== "super_admin") {
    return {
      ok: false as const,
      response: NextResponse.json(
        {
          success: false,
          message: "Hanya Super Admin yang dapat mengelola akun dosen.",
        },
        { status: 403 },
      ),
    };
  }

  return { ok: true as const, user };
}

export async function GET() {
  try {
    const auth = await requireSuperAdmin();
    if (!auth.ok) return auth.response;

    const admin = createAdminClient();

    const [{ data: profiles, error: profileError }, membershipsRes, usersRes] =
      await Promise.all([
        admin
          .from("admin_profiles")
          .select("user_id, display_name, role")
          .in("role", ["lecturer", "assistant"])
          .order("display_name"),
        admin.from("course_members").select("user_id, course_id"),
        admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      ]);

    if (profileError) throw profileError;
    if (membershipsRes.error) throw membershipsRes.error;
    if (usersRes.error) throw usersRes.error;

    const emailById = new Map(
      usersRes.data.users.map((user) => [user.id, user.email ?? ""]),
    );

    const courseIdsByUser = new Map<string, string[]>();
    for (const membership of membershipsRes.data ?? []) {
      const current = courseIdsByUser.get(membership.user_id) ?? [];
      current.push(membership.course_id);
      courseIdsByUser.set(membership.user_id, current);
    }

    const lecturers = (profiles ?? []).map((profile) => {
      const courseIds = courseIdsByUser.get(profile.user_id) ?? [];
      return {
        user_id: profile.user_id,
        email: emailById.get(profile.user_id) ?? "",
        display_name: profile.display_name ?? "Tanpa Nama",
        role: profile.role,
        course_count: courseIds.length,
        course_ids: courseIds,
      };
    });

    return NextResponse.json(
      { success: true, lecturers },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: any) {
    console.error("GET LECTURERS ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Gagal memuat daftar dosen.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin();
    if (!auth.ok) return auth.response;

    const body = await request.json();

    const displayName = String(body.display_name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (displayName.length < 3) {
      return NextResponse.json(
        { success: false, message: "Nama dosen minimal 3 karakter." },
        { status: 400 },
      );
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json(
        { success: false, message: "Email tidak valid." },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, message: "Password awal minimal 8 karakter." },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: displayName,
        },
      });

    if (createError || !created.user) {
      return NextResponse.json(
        {
          success: false,
          message: createError?.message || "Gagal membuat akun dosen.",
        },
        { status: 400 },
      );
    }

    const userId = created.user.id;

    const { error: profileError } = await admin.from("admin_profiles").upsert(
      {
        user_id: userId,
        display_name: displayName,
        role: "lecturer",
      },
      { onConflict: "user_id" },
    );

    if (profileError) {
      await admin.auth.admin.deleteUser(userId);
      throw profileError;
    }

    return NextResponse.json({
      success: true,
      message: "Akun dosen berhasil dibuat.",
      lecturer: {
        user_id: userId,
        email,
        display_name: displayName,
        role: "lecturer",
        course_count: 0,
        course_ids: [],
      },
    });
  } catch (error: any) {
    console.error("CREATE LECTURER ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: error?.message || "Terjadi kesalahan saat membuat akun dosen.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin();
    if (!auth.ok) return auth.response;

    const body = await request.json();

    const userId = String(body.user_id ?? "").trim();
    const displayName = String(body.display_name ?? "").trim();
    const newPassword = String(body.new_password ?? "");

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "User dosen tidak valid." },
        { status: 400 },
      );
    }

    if (displayName.length < 3) {
      return NextResponse.json(
        { success: false, message: "Nama dosen minimal 3 karakter." },
        { status: 400 },
      );
    }

    if (newPassword && newPassword.length < 8) {
      return NextResponse.json(
        { success: false, message: "Password baru minimal 8 karakter." },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    const { data: profile, error: profileLookupError } = await admin
      .from("admin_profiles")
      .select("user_id, role, display_name")
      .eq("user_id", userId)
      .maybeSingle();

    if (profileLookupError) throw profileLookupError;

    if (!profile || profile.role !== "lecturer") {
      return NextResponse.json(
        { success: false, message: "Akun dosen tidak ditemukan." },
        { status: 404 },
      );
    }

    if (newPassword) {
      const { error: passwordError } =
        await admin.auth.admin.updateUserById(userId, {
          password: newPassword,
          user_metadata: {
            full_name: displayName,
          },
        });

      if (passwordError) {
        return NextResponse.json(
          {
            success: false,
            message: `Gagal reset password dosen: ${passwordError.message}`,
          },
          { status: passwordError.status ?? 400 },
        );
      }
    } else {
      const { error: metadataError } =
        await admin.auth.admin.updateUserById(userId, {
          user_metadata: {
            full_name: displayName,
          },
        });

      if (metadataError) {
        return NextResponse.json(
          {
            success: false,
            message: `Gagal memperbarui akun Auth dosen: ${metadataError.message}`,
          },
          { status: metadataError.status ?? 400 },
        );
      }
    }

    const { error: profileError } = await admin
      .from("admin_profiles")
      .update({ display_name: displayName })
      .eq("user_id", userId);

    if (profileError) throw profileError;

    const { data: memberships, error: membershipError } = await admin
      .from("course_members")
      .select("course_id")
      .eq("user_id", userId)
      .eq("role", "lecturer");

    if (membershipError) throw membershipError;

    const courseIds = (memberships ?? []).map((row) => row.course_id);

    if (courseIds.length) {
      const { error: courseError } = await admin
        .from("courses")
        .update({ lecturer: displayName })
        .in("id", courseIds);

      if (courseError) throw courseError;
    }

    return NextResponse.json({
      success: true,
      message: newPassword
        ? "Nama dan password dosen berhasil diperbarui."
        : "Nama dosen berhasil diperbarui.",
    });
  } catch (error: any) {
    console.error("UPDATE LECTURER ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error?.message ||
          "Terjadi kesalahan saat memperbarui akun dosen.",
      },
      { status: 500 },
    );
  }
}
