-- =====================================================================
-- SISTEM REKAP AKADEMIK - NEXT.JS + SUPABASE
-- Mendukung banyak kelas, absensi, komponen nilai, bobot, dan nilai akhir.
-- Script aman dijalankan ulang untuk meng-upgrade versi project sebelumnya.
-- =====================================================================

create extension if not exists pgcrypto;

do $$ begin
  create type public.attendance_status as enum ('H', 'I', 'S', 'A');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  class_name text not null,
  lecturer text not null,
  schedule text not null default '',
  min_attendance_pct integer not null default 80,
  created_at timestamptz not null default now()
);

-- Upgrade kolom untuk versi fleksibel.
alter table public.courses add column if not exists semester text not null default '';
alter table public.courses add column if not exists academic_year text not null default '';
alter table public.courses add column if not exists meeting_count integer not null default 16;
alter table public.courses add column if not exists publish_grades boolean not null default false;
alter table public.courses drop constraint if exists courses_min_attendance_pct_check;
alter table public.courses add constraint courses_min_attendance_pct_check check (min_attendance_pct between 0 and 100);
alter table public.courses drop constraint if exists courses_meeting_count_check;
alter table public.courses add constraint courses_meeting_count_check check (meeting_count between 1 and 40);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  npm text not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique(course_id, npm)
);

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  meeting_no integer not null,
  meeting_date date not null,
  created_at timestamptz not null default now(),
  unique(course_id, meeting_no)
);
alter table public.meetings drop constraint if exists meetings_meeting_no_check;
alter table public.meetings add constraint meetings_meeting_no_check check (meeting_no between 1 and 40);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status public.attendance_status not null,
  updated_at timestamptz not null default now(),
  unique(meeting_id, student_id)
);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  name text not null,
  category text not null default 'Lainnya',
  max_score numeric(8,2) not null default 100 check (max_score > 0),
  weight numeric(6,2) not null default 0 check (weight between 0 and 100),
  sort_order integer not null default 1,
  created_at timestamptz not null default now(),
  unique(course_id, name)
);

create table if not exists public.grades (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  score numeric(8,2) not null check (score >= 0),
  updated_at timestamptz not null default now(),
  unique(assessment_id, student_id)
);

create table if not exists public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_profiles ap where ap.user_id = auth.uid()
  );
$$;

-- RLS
alter table public.courses enable row level security;
alter table public.students enable row level security;
alter table public.meetings enable row level security;
alter table public.attendance enable row level security;
alter table public.assessments enable row level security;
alter table public.grades enable row level security;
alter table public.admin_profiles enable row level security;

revoke all on public.courses, public.students, public.meetings, public.attendance, public.assessments, public.grades, public.admin_profiles from anon, authenticated;
grant select on public.courses, public.students, public.meetings, public.attendance, public.assessments, public.grades to anon, authenticated;
grant insert, update, delete on public.courses, public.students, public.meetings, public.attendance, public.assessments, public.grades to authenticated;
grant select on public.admin_profiles to authenticated;

-- Bersihkan policy lama/baru agar script dapat dijalankan ulang.
drop policy if exists "Public read courses" on public.courses;
drop policy if exists "Public read students" on public.students;
drop policy if exists "Public read meetings" on public.meetings;
drop policy if exists "Public read attendance" on public.attendance;
drop policy if exists "Public read published assessments" on public.assessments;
drop policy if exists "Public read published grades" on public.grades;
drop policy if exists "Admins manage courses" on public.courses;
drop policy if exists "Admins manage students" on public.students;
drop policy if exists "Admins manage meetings" on public.meetings;
drop policy if exists "Admins manage attendance" on public.attendance;
drop policy if exists "Admins manage assessments" on public.assessments;
drop policy if exists "Admins manage grades" on public.grades;
drop policy if exists "Admins read own profile" on public.admin_profiles;

create policy "Public read courses" on public.courses for select to anon, authenticated using (true);
create policy "Public read students" on public.students for select to anon, authenticated using (true);
create policy "Public read meetings" on public.meetings for select to anon, authenticated using (true);
create policy "Public read attendance" on public.attendance for select to anon, authenticated using (true);

-- Nilai publik hanya dapat dibaca jika admin mengaktifkan publish_grades pada kelas tersebut.
create policy "Public read published assessments" on public.assessments
for select to anon, authenticated
using (
  exists (
    select 1 from public.courses c
    where c.id = assessments.course_id and c.publish_grades = true
  )
);

create policy "Public read published grades" on public.grades
for select to anon, authenticated
using (
  exists (
    select 1
    from public.assessments a
    join public.courses c on c.id = a.course_id
    where a.id = grades.assessment_id and c.publish_grades = true
  )
);

create policy "Admins manage courses" on public.courses for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage students" on public.students for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage meetings" on public.meetings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage attendance" on public.attendance for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage assessments" on public.assessments for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins manage grades" on public.grades for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "Admins read own profile" on public.admin_profiles for select to authenticated using (user_id = auth.uid());

-- =====================================================================
-- DATA AWAL DARI FILE ABSENSI YANG DIBERIKAN
-- =====================================================================
insert into public.courses (
  id, name, class_name, lecturer, schedule, semester, academic_year,
  min_attendance_pct, meeting_count, publish_grades
)
values (
  '11111111-1111-1111-1111-111111111111',
  'Sistem Basis Data',
  'TK 25 A',
  'Yuri Rahmanto, M.Kom.',
  'Kamis',
  'Ganjil',
  '2026/2027',
  80,
  16,
  false
)
on conflict (id) do update set
  name = excluded.name,
  class_name = excluded.class_name,
  lecturer = excluded.lecturer,
  min_attendance_pct = excluded.min_attendance_pct,
  meeting_count = excluded.meeting_count;

insert into public.meetings (course_id, meeting_no, meeting_date) values
('11111111-1111-1111-1111-111111111111', 1, '2026-09-24'),
('11111111-1111-1111-1111-111111111111', 2, '2026-10-01'),
('11111111-1111-1111-1111-111111111111', 3, '2026-10-08'),
('11111111-1111-1111-1111-111111111111', 4, '2026-10-15'),
('11111111-1111-1111-1111-111111111111', 5, '2026-10-22'),
('11111111-1111-1111-1111-111111111111', 6, '2026-10-29'),
('11111111-1111-1111-1111-111111111111', 7, '2026-11-05'),
('11111111-1111-1111-1111-111111111111', 8, '2026-11-12'),
('11111111-1111-1111-1111-111111111111', 9, '2026-11-19'),
('11111111-1111-1111-1111-111111111111', 10, '2026-11-26'),
('11111111-1111-1111-1111-111111111111', 11, '2026-12-03'),
('11111111-1111-1111-1111-111111111111', 12, '2026-12-10'),
('11111111-1111-1111-1111-111111111111', 13, '2026-12-17'),
('11111111-1111-1111-1111-111111111111', 14, '2026-12-24'),
('11111111-1111-1111-1111-111111111111', 15, '2026-12-31'),
('11111111-1111-1111-1111-111111111111', 16, '2027-01-07')
on conflict (course_id, meeting_no) do update set meeting_date = excluded.meeting_date;

insert into public.students (course_id, npm, name) values
('11111111-1111-1111-1111-111111111111', '22316009', 'NUR RAHMATULLAH'),
('11111111-1111-1111-1111-111111111111', '23316017', 'WIDYAWATI'),
('11111111-1111-1111-1111-111111111111', '25316001', 'ACHMED FAOZAN ADIPUTRA'),
('11111111-1111-1111-1111-111111111111', '25316004', 'AHLUN NAZAR'),
('11111111-1111-1111-1111-111111111111', '25316009', 'M. FITRA SATRIA PRAYOGI'),
('11111111-1111-1111-1111-111111111111', '25316011', 'MUHAMAD RIVA'),
('11111111-1111-1111-1111-111111111111', '25316015', 'BANGKIT ALAMSYAH'),
('11111111-1111-1111-1111-111111111111', '25316021', 'DESVITA ANGGRAINI'),
('11111111-1111-1111-1111-111111111111', '25316022', 'FEBRI ANANDA REFLI DWI PUTRI'),
('11111111-1111-1111-1111-111111111111', '25316028', 'WALDAN AHHAF NAUFAL ROBBNI'),
('11111111-1111-1111-1111-111111111111', '25316030', 'PADHLAN SATYA AKILA'),
('11111111-1111-1111-1111-111111111111', '25316033', 'ZAHARA SALSABILA'),
('11111111-1111-1111-1111-111111111111', '25316034', 'NOPITA SAFITRI'),
('11111111-1111-1111-1111-111111111111', '25316035', 'MUHAMMAD AQIL BASYUNI'),
('11111111-1111-1111-1111-111111111111', '25316038', 'AHMAD YUSUF DARMANSAH'),
('11111111-1111-1111-1111-111111111111', '25316039', 'M. IRFAN'),
('11111111-1111-1111-1111-111111111111', '25316041', 'GALANG FIRMANSYAH SAPUTRA'),
('11111111-1111-1111-1111-111111111111', '25316044', 'BAGAS PRAYOGA'),
('11111111-1111-1111-1111-111111111111', '25316048', 'MUHAMMAD AFLAH FADHILA'),
('11111111-1111-1111-1111-111111111111', '25316049', 'MUHAMMAD FIRDANA YUSUF'),
('11111111-1111-1111-1111-111111111111', '25316050', 'MUHAMAD IRFAN HIDAYAT')
on conflict (course_id, npm) do update set name = excluded.name;

-- Komponen nilai default untuk kelas lama. Kelas baru dibuat otomatis oleh dashboard.
insert into public.assessments (course_id, name, category, max_score, weight, sort_order) values
('11111111-1111-1111-1111-111111111111', 'Tugas', 'Tugas', 100, 25, 1),
('11111111-1111-1111-1111-111111111111', 'Quiz', 'Quiz', 100, 15, 2),
('11111111-1111-1111-1111-111111111111', 'UTS', 'UTS', 100, 25, 3),
('11111111-1111-1111-1111-111111111111', 'UAS', 'UAS', 100, 35, 4)
on conflict (course_id, name) do nothing;

-- =====================================================================
-- MEMBUAT ADMIN PERTAMA (jalankan setelah membuat user di Authentication)
-- =====================================================================
-- insert into public.admin_profiles (user_id, display_name)
-- select id, coalesce(raw_user_meta_data->>'full_name', email)
-- from auth.users
-- where email = 'admin@kampus.ac.id'
-- on conflict (user_id) do nothing;
