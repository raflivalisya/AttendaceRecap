import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { createAdminClient } from "@/lib/supabase/admin";

function normalizeNpm(value: unknown) {
  return String(value ?? "").trim();
}

function internalEmail(npm: string) {
  const safe = npm.toLowerCase().replace(/[^a-z0-9._-]/g, "");
  return `student.${safe}@student.example.com`;
}

export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("student_portal_profiles")
    .select("user_id, npm, full_name, auth_email, is_active, created_at")
    .order("full_name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ accounts: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const npm = normalizeNpm(body.npm);
  const password = String(body.password ?? "");

  if (!npm || password.length < 8) {
    return NextResponse.json(
      { error: "NPM wajib diisi dan password minimal 8 karakter." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: student, error: studentError } = await admin
    .from("students")
    .select("npm, name")
    .eq("npm", npm)
    .limit(1)
    .maybeSingle();

  if (studentError) {
    return NextResponse.json({ error: studentError.message }, { status: 400 });
  }

  if (!student) {
    return NextResponse.json(
      { error: "NPM belum ditemukan pada data mahasiswa." },
      { status: 404 },
    );
  }

  const { data: existing } = await admin
    .from("student_portal_profiles")
    .select("user_id")
    .eq("npm", npm)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "Akun portal untuk NPM ini sudah ada." },
      { status: 409 },
    );
  }

  const authEmail = internalEmail(npm);

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: student.name,
        npm,
        account_type: "student",
      },
    });

  if (createError || !created.user) {
    return NextResponse.json(
      { error: createError?.message ?? "Gagal membuat akun Auth." },
      { status: createError?.status ?? 400 },
    );
  }

  const { data: profile, error: profileError } = await admin
    .from("student_portal_profiles")
    .insert({
      user_id: created.user.id,
      npm,
      full_name: student.name,
      auth_email: authEmail,
      is_active: true,
    })
    .select("user_id, npm, full_name, auth_email, is_active, created_at")
    .single();

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  await admin.from("audit_logs").insert({
    actor_user_id: auth.user.id,
    entity_table: "student_portal_profiles",
    entity_id: created.user.id,
    action: "AUTH",
    summary: `Membuat akun portal mahasiswa ${npm}`,
    new_data: { npm, full_name: student.name },
  });

  return NextResponse.json({ ok: true, account: profile });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const userId = String(body.user_id ?? "").trim();
  const newPassword = String(body.new_password ?? "");
  const isActive =
    typeof body.is_active === "boolean" ? body.is_active : undefined;

  if (!userId) {
    return NextResponse.json({ error: "user_id wajib diisi." }, { status: 400 });
  }

  if (newPassword && newPassword.length < 8) {
    return NextResponse.json(
      { error: "Password baru minimal 8 karakter." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  if (newPassword) {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  if (isActive !== undefined) {
    const { error } = await admin
      .from("student_portal_profiles")
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  await admin.from("audit_logs").insert({
    actor_user_id: auth.user.id,
    entity_table: "student_portal_profiles",
    entity_id: userId,
    action: "AUTH",
    summary: newPassword
      ? "Reset password akun mahasiswa"
      : "Mengubah status akun mahasiswa",
    new_data: {
      password_reset: Boolean(newPassword),
      is_active: isActive,
    },
  });

  return NextResponse.json({ ok: true });
}
