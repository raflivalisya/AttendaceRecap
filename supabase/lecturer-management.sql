-- =========================================================
-- LECTURER MANAGEMENT + COURSE MEMBERSHIP
-- Jalankan sekali di Supabase SQL Editor.
-- Aman dijalankan ulang.
-- =========================================================

begin;

-- ---------------------------------------------------------
-- ROLE PADA ADMIN PROFILES
-- ---------------------------------------------------------

alter table public.admin_profiles
add column if not exists role text;

update public.admin_profiles
set role = 'lecturer'
where role is null or role = '';

alter table public.admin_profiles
alter column role set default 'lecturer';

alter table public.admin_profiles
alter column role set not null;

alter table public.admin_profiles
drop constraint if exists admin_profiles_role_check;

alter table public.admin_profiles
add constraint admin_profiles_role_check
check (role in ('super_admin', 'lecturer', 'assistant'));

-- ---------------------------------------------------------
-- COURSE MEMBERS
-- ---------------------------------------------------------

create table if not exists public.course_members (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'lecturer',
  created_at timestamptz not null default now(),
  unique(course_id, user_id),
  constraint course_members_role_check
    check (role in ('lecturer', 'assistant'))
);

create index if not exists course_members_course_id_idx
on public.course_members(course_id);

create index if not exists course_members_user_id_idx
on public.course_members(user_id);

-- ---------------------------------------------------------
-- SUPER ADMIN HELPER
-- ---------------------------------------------------------

create schema if not exists private;

create or replace function private.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_profiles ap
    where ap.user_id = (select auth.uid())
      and ap.role = 'super_admin'
  );
$$;

grant usage on schema private to authenticated;
grant execute on function private.is_super_admin() to authenticated;

-- ---------------------------------------------------------
-- RLS ADMIN PROFILES
-- ---------------------------------------------------------

alter table public.admin_profiles enable row level security;

grant select, insert, update, delete
on public.admin_profiles
to authenticated;

drop policy if exists "Users read own profile" on public.admin_profiles;
drop policy if exists "Super admins insert profiles" on public.admin_profiles;
drop policy if exists "Super admins update profiles" on public.admin_profiles;
drop policy if exists "Super admins delete profiles" on public.admin_profiles;

create policy "Users read own profile"
on public.admin_profiles
for select
to authenticated
using (
  user_id = (select auth.uid())
  or private.is_super_admin()
);

create policy "Super admins insert profiles"
on public.admin_profiles
for insert
to authenticated
with check (private.is_super_admin());

create policy "Super admins update profiles"
on public.admin_profiles
for update
to authenticated
using (private.is_super_admin())
with check (private.is_super_admin());

create policy "Super admins delete profiles"
on public.admin_profiles
for delete
to authenticated
using (private.is_super_admin());

-- ---------------------------------------------------------
-- RLS COURSE MEMBERS
-- ---------------------------------------------------------

alter table public.course_members enable row level security;

grant select, insert, update, delete
on public.course_members
to authenticated;

drop policy if exists "Users read course memberships" on public.course_members;
drop policy if exists "Super admins insert course memberships" on public.course_members;
drop policy if exists "Super admins update course memberships" on public.course_members;
drop policy if exists "Super admins delete course memberships" on public.course_members;

create policy "Users read course memberships"
on public.course_members
for select
to authenticated
using (
  user_id = (select auth.uid())
  or private.is_super_admin()
);

create policy "Super admins insert course memberships"
on public.course_members
for insert
to authenticated
with check (private.is_super_admin());

create policy "Super admins update course memberships"
on public.course_members
for update
to authenticated
using (private.is_super_admin())
with check (private.is_super_admin());

create policy "Super admins delete course memberships"
on public.course_members
for delete
to authenticated
using (private.is_super_admin());

commit;

-- =========================================================
-- SET SUPER ADMIN PERTAMA
-- GANTI EMAIL DI BAWAH, LALU JALANKAN TERPISAH JIKA PERLU.
-- =========================================================
-- update public.admin_profiles ap
-- set role = 'super_admin'
-- from auth.users u
-- where ap.user_id = u.id
--   and u.email = 'EMAIL_SUPER_ADMIN@kampus.ac.id';
