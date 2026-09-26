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

async function ensureOneStudentAccount(
  admin: ReturnType<typeof createAdminClient>,
  npm: string,
  fullName: string,
) {
  const normalizedNpm = normalizeNpm(npm);
  const name = String(fullName ?? "").trim().toUpperCase();

  if (!normalizedNpm || !name) {
    throw new Error("NPM dan nama mahasiswa wajib diisi.");
  }

  if (normalizedNpm.length < 6) {
    throw new Error(
      `NPM ${normalizedNpm} terlalu pendek untuk dijadikan password Supabase. Minimal 6 karakter.`,
    );
  }

  const { data: existingProfile, error: profileLookupError } = await admin
    .from("student_portal_profiles")
    .select("user_id, npm, full_name, auth_email, is_active")
    .eq("npm", normalizedNpm)
    .maybeSingle();

  if (profileLookupError) throw profileLookupError;

  if (existingProfile) {
    if (existingProfile.full_name !== name) {
      await admin
        .from("student_portal_profiles")
        .update({
          full_name: name,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", existingProfile.user_id);

      await admin.auth.admin.updateUserById(existingProfile.user_id, {
        user_metadata: {
          full_name: name,
          npm: normalizedNpm,
          account_type: "student",
        },
      });
    }

    return {
      created: false,
      account: existingProfile,
    };
  }

  const authEmail = internalEmail(normalizedNpm);

  let authUserId = "";

  const { data: usersPage } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  const existingAuthUser = usersPage?.users?.find(
    (user) => user.email?.toLowerCase() === authEmail.toLowerCase(),
  );

  if (existingAuthUser) {
    authUserId = existingAuthUser.id;

    // Akun orphan lama: password dikembalikan ke default NPM.
    const { error: resetError } = await admin.auth.admin.updateUserById(
      authUserId,
      {
        password: normalizedNpm,
        email_confirm: true,
        user_metadata: {
          full_name: name,
          npm: normalizedNpm,
          account_type: "student",
        },
      },
    );

    if (resetError) throw resetError;
  } else {
    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email: authEmail,
        password: normalizedNpm,
        email_confirm: true,
        user_metadata: {
          full_name: name,
          npm: normalizedNpm,
          account_type: "student",
        },
      });

    if (createError || !created.user) {
      throw new Error(
        createError?.message ?? `Gagal membuat akun Auth ${normalizedNpm}.`,
      );
    }

    authUserId = created.user.id;
  }

  const { data: profile, error: insertError } = await admin
    .from("student_portal_profiles")
    .insert({
      user_id: authUserId,
      npm: normalizedNpm,
      full_name: name,
      auth_email: authEmail,
      is_active: true,
    })
    .select("user_id, npm, full_name, auth_email, is_active, created_at")
    .single();

  if (insertError) throw insertError;

  return {
    created: true,
    account: profile,
  };
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

  if (!npm) {
    return NextResponse.json({ error: "NPM wajib diisi." }, { status: 400 });
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

  try {
    const result = await ensureOneStudentAccount(admin, student.npm, student.name);

    await admin.from("audit_logs").insert({
      actor_user_id: auth.user.id,
      entity_table: "student_portal_profiles",
      entity_id: result.account.user_id,
      action: "AUTH",
      summary: result.created
        ? `Membuat akun portal mahasiswa ${npm} dengan password default NPM`
        : `Memastikan akun portal mahasiswa ${npm} tersedia`,
      new_data: {
        npm,
        full_name: student.name,
        default_password_is_npm: result.created,
      },
    });

    return NextResponse.json({
      ok: true,
      created: result.created,
      account: result.account,
      default_password: npm,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Gagal membuat akun mahasiswa.",
      },
      { status: 400 },
    );
  }
}

export async function PUT() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from("students")
    .select("npm, name")
    .order("npm");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const unique = new Map<string, string>();

  for (const row of rows ?? []) {
    if (!unique.has(row.npm)) {
      unique.set(row.npm, row.name);
    }
  }

  let created = 0;
  let existing = 0;
  const errors: string[] = [];

  for (const [npm, name] of unique) {
    try {
      const result = await ensureOneStudentAccount(admin, npm, name);
      if (result.created) created += 1;
      else existing += 1;
    } catch (error) {
      errors.push(
        `${npm}: ${error instanceof Error ? error.message : "gagal"}`,
      );
    }
  }

  await admin.from("audit_logs").insert({
    actor_user_id: auth.user.id,
    entity_table: "student_portal_profiles",
    action: "AUTH",
    summary: "Sinkronisasi seluruh akun Student Portal",
    new_data: {
      created,
      existing,
      error_count: errors.length,
    },
  });

  return NextResponse.json({
    ok: errors.length === 0,
    created,
    existing,
    errors,
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const userId = String(body.user_id ?? "").trim();
  const newPassword = String(body.new_password ?? "");
  const resetToNpm = Boolean(body.reset_to_npm);
  const isActive =
    typeof body.is_active === "boolean" ? body.is_active : undefined;

  if (!userId) {
    return NextResponse.json({ error: "user_id wajib diisi." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("student_portal_profiles")
    .select("user_id, npm")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  if (!profile) {
    return NextResponse.json({ error: "Akun mahasiswa tidak ditemukan." }, { status: 404 });
  }

  const passwordToSet = resetToNpm ? profile.npm : newPassword;

  if (passwordToSet && passwordToSet.length < 6) {
    return NextResponse.json(
      { error: "Password minimal 6 karakter." },
      { status: 400 },
    );
  }

  if (passwordToSet) {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: passwordToSet,
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
    summary: resetToNpm
      ? "Reset password mahasiswa ke NPM"
      : newPassword
        ? "Reset password akun mahasiswa"
        : "Mengubah status akun mahasiswa",
    new_data: {
      reset_to_npm: resetToNpm,
      password_reset: Boolean(passwordToSet),
      is_active: isActive,
    },
  });

  return NextResponse.json({
    ok: true,
    password_reset_to_npm: resetToNpm,
  });
}
