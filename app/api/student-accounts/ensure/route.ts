import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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


type RequestedStudent = {
  npm: string;
  name?: string;
};

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const courseId = String(body.course_id ?? "").trim();
  const requested = Array.isArray(body.students)
    ? (body.students as RequestedStudent[])
    : [];

  if (!courseId || !requested.length) {
    return NextResponse.json(
      { error: "course_id dan daftar mahasiswa wajib diisi." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: actorProfile } = await admin
    .from("admin_profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  const isSuperAdmin = actorProfile?.role === "super_admin";

  if (!isSuperAdmin) {
    const { data: membership } = await admin
      .from("course_members")
      .select("role")
      .eq("course_id", courseId)
      .eq("user_id", user.id)
      .in("role", ["lecturer", "assistant"])
      .maybeSingle();

    if (!membership) {
      return NextResponse.json(
        { error: "Tidak memiliki akses ke kelas ini." },
        { status: 403 },
      );
    }
  }

  const npmList = Array.from(
    new Set(
      requested
        .map((item) => normalizeNpm(item.npm))
        .filter(Boolean),
    ),
  );

  const { data: databaseStudents, error: studentError } = await admin
    .from("students")
    .select("npm, name")
    .eq("course_id", courseId)
    .in("npm", npmList);

  if (studentError) {
    return NextResponse.json({ error: studentError.message }, { status: 400 });
  }

  const rows = databaseStudents ?? [];
  let created = 0;
  let existing = 0;
  const errors: string[] = [];

  for (const student of rows) {
    try {
      const result = await ensureOneStudentAccount(
        admin,
        student.npm,
        student.name,
      );

      if (result.created) created += 1;
      else existing += 1;
    } catch (error) {
      errors.push(
        `${student.npm}: ${error instanceof Error ? error.message : "gagal"}`,
      );
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    created,
    existing,
    errors,
    default_password_rule: "NPM",
  });
}
