-- ============================================================
-- MODUL ASISTEN DOSEN
-- AttendanceRecap / Next.js + Supabase
-- Jalankan SETELAH lecturer-management.sql / role system yang sudah ada.
-- ============================================================

begin;

create extension if not exists pgcrypto;
create schema if not exists private;

alter table public.admin_profiles add column if not exists role text default 'lecturer';
alter table public.admin_profiles drop constraint if exists admin_profiles_role_check;
alter table public.admin_profiles add constraint admin_profiles_role_check check (role in ('super_admin','lecturer','assistant'));

create table if not exists public.course_members (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('lecturer','assistant')),
  created_at timestamptz not null default now(),
  unique(course_id,user_id)
);

create table if not exists public.assistant_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  auth_email text not null unique,
  full_name text not null,
  npm text,
  program_study text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists assistant_profiles_username_lower_uidx on public.assistant_profiles(lower(username));

create table if not exists public.assistant_schedule_templates (
  id uuid primary key default gen_random_uuid(),
  assistant_user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid references public.courses(id) on delete set null,
  weekday smallint not null check (weekday between 1 and 6),
  day_name text not null,
  start_time time not null,
  end_time time not null,
  class_label text not null default '',
  course_name text not null default '',
  lecturer_name text not null default '',
  room text not null default '',
  source_filename text,
  source_sheet text,
  created_at timestamptz not null default now(),
  unique(assistant_user_id,weekday,start_time,class_label,course_name)
);

create table if not exists public.assistant_activity_logs (
  id uuid primary key default gen_random_uuid(),
  assistant_user_id uuid not null references auth.users(id) on delete cascade,
  schedule_template_id uuid references public.assistant_schedule_templates(id) on delete set null,
  course_id uuid references public.courses(id) on delete set null,
  activity_date date not null,
  start_time time not null,
  end_time time not null,
  class_label text not null default '',
  room text not null default '',
  course_name text not null default '',
  material text not null default '',
  lecturer_name text not null default '',
  activity_type text not null default 'Mengajar',
  notes text not null default '',
  status text not null default 'draft' check (status in ('draft','submitted','approved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(assistant_user_id,activity_date,start_time,class_label,course_name)
);

create table if not exists public.assistant_import_batches (
  id uuid primary key default gen_random_uuid(),
  assistant_user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  imported_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists assistant_schedule_user_idx on public.assistant_schedule_templates(assistant_user_id,weekday,start_time);
create index if not exists assistant_logs_user_date_idx on public.assistant_activity_logs(assistant_user_id,activity_date);
create index if not exists course_members_user_role_idx on public.course_members(user_id,role);

create or replace function private.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select ap.role from public.admin_profiles ap where ap.user_id = auth.uid();
$$;

create or replace function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.current_app_role() = 'super_admin', false);
$$;

create or replace function private.can_access_course(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_super_admin()
    or exists (
      select 1 from public.course_members cm
      where cm.course_id = target_course_id and cm.user_id = auth.uid()
    );
$$;

create or replace function private.can_manage_attendance(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_super_admin()
    or exists (
      select 1 from public.course_members cm
      where cm.course_id = target_course_id
        and cm.user_id = auth.uid()
        and cm.role in ('lecturer','assistant')
    );
$$;

create or replace function private.course_from_meeting(target_meeting_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.course_id from public.meetings m where m.id = target_meeting_id;
$$;

grant usage on schema private to authenticated;
grant execute on function private.current_app_role() to authenticated;
grant execute on function private.is_super_admin() to authenticated;
grant execute on function private.can_access_course(uuid) to authenticated;
grant execute on function private.can_manage_attendance(uuid) to authenticated;
grant execute on function private.course_from_meeting(uuid) to authenticated;

grant select on public.assistant_profiles to authenticated;
grant select,insert,update,delete on public.assistant_schedule_templates to authenticated;
grant select,insert,update,delete on public.assistant_activity_logs to authenticated;
grant select,insert on public.assistant_import_batches to authenticated;

alter table public.assistant_profiles enable row level security;
alter table public.assistant_schedule_templates enable row level security;
alter table public.assistant_activity_logs enable row level security;
alter table public.assistant_import_batches enable row level security;

-- Profil: Asdos membaca profil sendiri; Super Admin boleh membaca semua.
drop policy if exists "Asdos read own profile" on public.assistant_profiles;
create policy "Asdos read own profile" on public.assistant_profiles for select to authenticated using (user_id = auth.uid() or private.is_super_admin());

drop policy if exists "Asdos update own profile" on public.assistant_profiles;
create policy "Asdos update own profile" on public.assistant_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Jadwal Asdos
drop policy if exists "Asdos own schedule select" on public.assistant_schedule_templates;
create policy "Asdos own schedule select" on public.assistant_schedule_templates for select to authenticated using (assistant_user_id = auth.uid() or private.is_super_admin());
drop policy if exists "Asdos own schedule insert" on public.assistant_schedule_templates;
create policy "Asdos own schedule insert" on public.assistant_schedule_templates for insert to authenticated with check (assistant_user_id = auth.uid());
drop policy if exists "Asdos own schedule update" on public.assistant_schedule_templates;
create policy "Asdos own schedule update" on public.assistant_schedule_templates for update to authenticated using (assistant_user_id = auth.uid()) with check (assistant_user_id = auth.uid());
drop policy if exists "Asdos own schedule delete" on public.assistant_schedule_templates;
create policy "Asdos own schedule delete" on public.assistant_schedule_templates for delete to authenticated using (assistant_user_id = auth.uid());

-- Rekap kegiatan Asdos
drop policy if exists "Asdos own logs select" on public.assistant_activity_logs;
create policy "Asdos own logs select" on public.assistant_activity_logs for select to authenticated using (
  assistant_user_id = auth.uid()
  or private.is_super_admin()
  or (course_id is not null and exists (select 1 from public.course_members cm where cm.course_id = assistant_activity_logs.course_id and cm.user_id = auth.uid() and cm.role = 'lecturer'))
);
drop policy if exists "Asdos own logs insert" on public.assistant_activity_logs;
create policy "Asdos own logs insert" on public.assistant_activity_logs for insert to authenticated with check (assistant_user_id = auth.uid());
drop policy if exists "Asdos own logs update" on public.assistant_activity_logs;
create policy "Asdos own logs update" on public.assistant_activity_logs for update to authenticated using (assistant_user_id = auth.uid()) with check (assistant_user_id = auth.uid());
drop policy if exists "Asdos own logs delete" on public.assistant_activity_logs;
create policy "Asdos own logs delete" on public.assistant_activity_logs for delete to authenticated using (assistant_user_id = auth.uid());

-- Riwayat import
drop policy if exists "Asdos own imports select" on public.assistant_import_batches;
create policy "Asdos own imports select" on public.assistant_import_batches for select to authenticated using (assistant_user_id = auth.uid() or private.is_super_admin());
drop policy if exists "Asdos own imports insert" on public.assistant_import_batches;
create policy "Asdos own imports insert" on public.assistant_import_batches for insert to authenticated with check (assistant_user_id = auth.uid());

-- Pastikan Asdos yang ditugaskan dapat membaca kelas, mahasiswa, pertemuan dan absensi.
alter table public.courses enable row level security;
alter table public.students enable row level security;
alter table public.meetings enable row level security;
alter table public.attendance enable row level security;

drop policy if exists "Asdos assigned courses read" on public.courses;
create policy "Asdos assigned courses read" on public.courses for select to authenticated using (private.can_access_course(id));

drop policy if exists "Asdos assigned students read" on public.students;
create policy "Asdos assigned students read" on public.students for select to authenticated using (private.can_access_course(course_id));

drop policy if exists "Asdos assigned meetings read" on public.meetings;
create policy "Asdos assigned meetings read" on public.meetings for select to authenticated using (private.can_access_course(course_id));

drop policy if exists "Asdos assigned attendance read" on public.attendance;
create policy "Asdos assigned attendance read" on public.attendance for select to authenticated using (private.can_access_course(private.course_from_meeting(meeting_id)));

drop policy if exists "Asdos attendance insert" on public.attendance;
create policy "Asdos attendance insert" on public.attendance for insert to authenticated with check (private.can_manage_attendance(private.course_from_meeting(meeting_id)));

drop policy if exists "Asdos attendance update" on public.attendance;
create policy "Asdos attendance update" on public.attendance for update to authenticated using (private.can_manage_attendance(private.course_from_meeting(meeting_id))) with check (private.can_manage_attendance(private.course_from_meeting(meeting_id)));

drop policy if exists "Asdos attendance delete" on public.attendance;
create policy "Asdos attendance delete" on public.attendance for delete to authenticated using (private.can_manage_attendance(private.course_from_meeting(meeting_id)));

-- QR/session: Asdos yang ditugaskan boleh membuka/menutup sesi QR kelasnya.
do $$
begin
  if to_regclass('public.attendance_sessions') is not null then
    execute 'alter table public.attendance_sessions enable row level security';
    execute 'drop policy if exists "Asdos attendance sessions select" on public.attendance_sessions';
    execute 'create policy "Asdos attendance sessions select" on public.attendance_sessions for select to authenticated using (private.can_manage_attendance(private.course_from_meeting(meeting_id)))';
    execute 'drop policy if exists "Asdos attendance sessions insert" on public.attendance_sessions';
    execute 'create policy "Asdos attendance sessions insert" on public.attendance_sessions for insert to authenticated with check (private.can_manage_attendance(private.course_from_meeting(meeting_id)))';
    execute 'drop policy if exists "Asdos attendance sessions update" on public.attendance_sessions';
    execute 'create policy "Asdos attendance sessions update" on public.attendance_sessions for update to authenticated using (private.can_manage_attendance(private.course_from_meeting(meeting_id))) with check (private.can_manage_attendance(private.course_from_meeting(meeting_id)))';
    execute 'drop policy if exists "Asdos attendance sessions delete" on public.attendance_sessions';
    execute 'create policy "Asdos attendance sessions delete" on public.attendance_sessions for delete to authenticated using (private.can_manage_attendance(private.course_from_meeting(meeting_id)))';
  end if;
end $$;

commit;
