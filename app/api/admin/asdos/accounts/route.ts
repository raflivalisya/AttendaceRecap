import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function jsonError(message: string, status = 500, detail?: unknown) {
  if (detail) console.error("[ASDOS_ACCOUNTS]", message, detail);
  else console.error("[ASDOS_ACCOUNTS]", message);
  return NextResponse.json({ error: message }, { status });
}

async function sessionContext() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized", status: 401 as const };
  }

  const { data: profile, error: profileError } = await supabase
    .from("admin_profiles")
    .select("user_id, display_name, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return {
      error: `Gagal membaca profil login: ${profileError.message}`,
      status: 500 as const,
    };
  }

  if (!profile) {
    return { error: "Profil tidak ditemukan.", status: 403 as const };
  }

  return { user, profile, supabase };
}

async function requireSuperAdmin() {
  const context = await sessionContext();
  if ("error" in context) return context;
  if (context.profile.role !== "super_admin") {
    return {
      error: "Hanya Super Admin yang dapat mengelola akun Asdos.",
      status: 403 as const,
    };
  }
  return context;
}

async function canManageCourse(
  userId: string,
  profileRole: string,
  courseId: string,
) {
  if (profileRole === "super_admin") return true;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("course_members")
    .select("id")
    .eq("course_id", courseId)
    .eq("user_id", userId)
    .eq("role", "lecturer")
    .maybeSingle();

  if (error) throw new Error(`Gagal memeriksa akses kelas: ${error.message}`);
  return Boolean(data);
}

function normalizeUsername(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function validateUsername(username: string) {
  return /^[a-z0-9._-]{3,32}$/.test(username);
}

function internalEmail(username: string) {
  return `${username}@asdos.example.com`;
}

export async function GET(request: NextRequest) {
  try {
    const context = await sessionContext();
    if ("error" in context) {
      return NextResponse.json({ error: context.error }, { status: context.status });
    }

    const courseId = request.nextUrl.searchParams.get("courseId") ?? "";

    if (courseId) {
      const allowed = await canManageCourse(
        context.user.id,
        context.profile.role,
        courseId,
      );
      if (!allowed) {
        return jsonError(
          "Anda tidak memiliki akses untuk mengatur Asdos pada kelas ini.",
          403,
        );
      }
    } else if (context.profile.role !== "super_admin") {
      return jsonError(
        "Hanya Super Admin yang dapat membuka seluruh akun Asdos.",
        403,
      );
    }

    const admin = createAdminClient();
    const { data: assistants, error } = await admin
      .from("assistant_profiles")
      .select("user_id, username, full_name, npm, program_study, is_active")
      .order("full_name");

    if (error) {
      return jsonError(`Gagal memuat assistant_profiles: ${error.message}`, 400, error);
    }

    let assignedUserIds: string[] = [];
    if (courseId) {
      const { data: rows, error: membershipError } = await admin
        .from("course_members")
        .select("user_id")
        .eq("course_id", courseId)
        .eq("role", "assistant");

      if (membershipError) {
        return jsonError(
          `Gagal membaca penugasan Asdos: ${membershipError.message}`,
          400,
          membershipError,
        );
      }
      assignedUserIds = (rows ?? []).map((row) => row.user_id);
    }

    return NextResponse.json({
      assistants: assistants ?? [],
      assigned_user_ids: assignedUserIds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi error server.";
    return jsonError(`Server GET akun Asdos: ${message}`, 500, error);
  }
}

export async function POST(request: NextRequest) {
  let createdUserId = "";

  try {
    const context = await requireSuperAdmin();
    if ("error" in context) {
      return NextResponse.json({ error: context.error }, { status: context.status });
    }

    const body = await request.json().catch(() => ({}));
    const fullName = String(body.full_name ?? "").trim();
    const username = normalizeUsername(body.username);
    const password = String(body.password ?? "");
    const npm = String(body.npm ?? "").trim();
    const programStudy = String(body.program_study ?? "").trim();

    if (fullName.length < 3) return jsonError("Nama Asdos minimal 3 karakter.", 400);
    if (!validateUsername(username)) {
      return jsonError(
        "Username hanya boleh berisi huruf kecil, angka, titik, underscore, atau strip (3-32 karakter).",
        400,
      );
    }
    if (password.length < 8) return jsonError("Password minimal 8 karakter.", 400);

    const admin = createAdminClient();
    const { data: existing, error: existingError } = await admin
      .from("assistant_profiles")
      .select("user_id")
      .ilike("username", username)
      .maybeSingle();

    if (existingError) return jsonError(`Gagal mengecek username: ${existingError.message}`, 400, existingError);
    if (existing) return jsonError("Username sudah digunakan.", 409);

    const authEmail = internalEmail(username);
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        account_type: "assistant",
        username,
      },
    });

    if (createError || !created.user) {
      return jsonError(
        `Supabase Auth gagal membuat user: ${createError?.message ?? "User tidak dikembalikan."}`,
        createError?.status ?? 400,
        createError,
      );
    }

    createdUserId = created.user.id;

    const { error: profileError } = await admin.from("admin_profiles").upsert(
      { user_id: createdUserId, display_name: fullName, role: "assistant" },
      { onConflict: "user_id" },
    );

    if (profileError) {
      await admin.auth.admin.deleteUser(createdUserId);
      createdUserId = "";
      return jsonError(
        `User Auth berhasil dibuat, tetapi admin_profiles gagal: ${profileError.message}`,
        400,
        profileError,
      );
    }

    const { data: assistant, error: assistantError } = await admin
      .from("assistant_profiles")
      .insert({
        user_id: createdUserId,
        username,
        auth_email: authEmail,
        full_name: fullName,
        npm: npm || null,
        program_study: programStudy || null,
        is_active: true,
      })
      .select("user_id, username, full_name, npm, program_study, is_active")
      .single();

    if (assistantError || !assistant) {
      await admin.from("admin_profiles").delete().eq("user_id", createdUserId);
      await admin.auth.admin.deleteUser(createdUserId);
      createdUserId = "";
      return jsonError(
        `User Auth berhasil dibuat, tetapi assistant_profiles gagal: ${assistantError?.message ?? "Row tidak dikembalikan."}`,
        400,
        assistantError,
      );
    }

    return NextResponse.json({ assistant }, { status: 201 });
  } catch (error) {
    if (createdUserId) {
      try {
        const admin = createAdminClient();
        await admin.from("assistant_profiles").delete().eq("user_id", createdUserId);
        await admin.from("admin_profiles").delete().eq("user_id", createdUserId);
        await admin.auth.admin.deleteUser(createdUserId);
      } catch (rollbackError) {
        console.error("[ASDOS_ACCOUNTS] rollback gagal", rollbackError);
      }
    }

    const message = error instanceof Error ? error.message : "Terjadi error server.";
    return jsonError(`Server POST akun Asdos: ${message}`, 500, error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const context = await requireSuperAdmin();
    if ("error" in context) {
      return NextResponse.json({ error: context.error }, { status: context.status });
    }

    const body = await request.json().catch(() => ({}));
    const userId = String(body.user_id ?? "").trim();
    const fullName = String(body.full_name ?? "").trim();
    const username = normalizeUsername(body.username);
    const npm = String(body.npm ?? "").trim();
    const programStudy = String(body.program_study ?? "").trim();
    const isActive = Boolean(body.is_active);
    const newPassword = String(body.new_password ?? "");

    if (!userId) return jsonError("user_id wajib diisi.", 400);
    if (fullName.length < 3) return jsonError("Nama Asdos minimal 3 karakter.", 400);
    if (!validateUsername(username)) {
      return jsonError(
        "Username hanya boleh berisi huruf kecil, angka, titik, underscore, atau strip (3-32 karakter).",
        400,
      );
    }
    if (newPassword && newPassword.length < 8) {
      return jsonError("Password baru minimal 8 karakter.", 400);
    }

    const admin = createAdminClient();
    const { data: current, error: currentError } = await admin
      .from("assistant_profiles")
      .select("user_id, username, auth_email, full_name")
      .eq("user_id", userId)
      .maybeSingle();

    if (currentError) return jsonError(`Gagal membaca akun Asdos: ${currentError.message}`, 400, currentError);
    if (!current) return jsonError("Akun Asdos tidak ditemukan.", 404);

    if (username !== String(current.username).toLowerCase()) {
      const { data: duplicate, error: duplicateError } = await admin
        .from("assistant_profiles")
        .select("user_id")
        .ilike("username", username)
        .neq("user_id", userId)
        .maybeSingle();

      if (duplicateError) return jsonError(`Gagal mengecek username: ${duplicateError.message}`, 400, duplicateError);
      if (duplicate) return jsonError("Username sudah digunakan akun Asdos lain.", 409);
    }

    const authEmail = internalEmail(username);
    const authChanges: {
      email?: string;
      password?: string;
      user_metadata?: Record<string, unknown>;
    } = {
      user_metadata: {
        full_name: fullName,
        account_type: "assistant",
        username,
      },
    };

    if (authEmail !== current.auth_email) authChanges.email = authEmail;
    if (newPassword) authChanges.password = newPassword;

    const { error: authUpdateError } = await admin.auth.admin.updateUserById(
      userId,
      authChanges,
    );

    if (authUpdateError) {
      return jsonError(`Gagal memperbarui Supabase Auth: ${authUpdateError.message}`, authUpdateError.status ?? 400, authUpdateError);
    }

    const { error: adminProfileError } = await admin
      .from("admin_profiles")
      .update({ display_name: fullName, role: "assistant" })
      .eq("user_id", userId);

    if (adminProfileError) {
      return jsonError(`Auth sudah diperbarui, tetapi admin_profiles gagal: ${adminProfileError.message}`, 400, adminProfileError);
    }

    const { data: assistant, error: assistantError } = await admin
      .from("assistant_profiles")
      .update({
        username,
        auth_email: authEmail,
        full_name: fullName,
        npm: npm || null,
        program_study: programStudy || null,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .select("user_id, username, full_name, npm, program_study, is_active")
      .single();

    if (assistantError || !assistant) {
      return jsonError(
        `Auth sudah diperbarui, tetapi assistant_profiles gagal: ${assistantError?.message ?? "Row tidak dikembalikan."}`,
        400,
        assistantError,
      );
    }

    return NextResponse.json({ assistant });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi error server.";
    return jsonError(`Server PATCH akun Asdos: ${message}`, 500, error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await requireSuperAdmin();
    if ("error" in context) {
      return NextResponse.json({ error: context.error }, { status: context.status });
    }

    const body = await request.json().catch(() => ({}));
    const userId = String(body.user_id ?? "").trim();
    if (!userId) return jsonError("user_id wajib diisi.", 400);

    if (userId === context.user.id) {
      return jsonError("Akun Super Admin yang sedang login tidak dapat dihapus dari menu Asdos.", 400);
    }

    const admin = createAdminClient();
    const { data: assistant, error: assistantError } = await admin
      .from("assistant_profiles")
      .select("user_id, full_name, username")
      .eq("user_id", userId)
      .maybeSingle();

    if (assistantError) return jsonError(`Gagal membaca akun Asdos: ${assistantError.message}`, 400, assistantError);
    if (!assistant) return jsonError("Akun Asdos tidak ditemukan.", 404);

    // Semua tabel modul Asdos dan course_members menggunakan FK auth.users ON DELETE CASCADE.
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      return jsonError(`Gagal menghapus akun Auth Asdos: ${deleteError.message}`, deleteError.status ?? 400, deleteError);
    }

    return NextResponse.json({
      ok: true,
      deleted_user_id: userId,
      deleted_name: assistant.full_name,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Terjadi error server.";
    return jsonError(`Server DELETE akun Asdos: ${message}`, 500, error);
  }
}
