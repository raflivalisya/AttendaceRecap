-- =========================================================
-- DASHBOARD ANALITIK + REALTIME MONITORING
-- AttendanceRecap
-- Jalankan sekali di Supabase SQL Editor.
-- =========================================================

begin;

-- ---------------------------------------------------------
-- 1. Izin baca attendance_checkins untuk user authenticated
--    yang memang punya akses ke kelas/pertemuan tersebut.
--    Mengandalkan helper private.can_manage_meeting_attendance
--    dari fitur role dosen yang sudah dipasang.
-- ---------------------------------------------------------

grant select on public.attendance_checkins to authenticated;

alter table public.attendance_checkins enable row level security;

drop policy if exists "Course members read attendance checkins"
on public.attendance_checkins;

create policy "Course members read attendance checkins"
on public.attendance_checkins
for select
to authenticated
using (
  private.can_manage_meeting_attendance(meeting_id)
);

commit;

-- ---------------------------------------------------------
-- 2. Pastikan publication Supabase Realtime tersedia.
-- ---------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    execute 'create publication supabase_realtime';
  end if;
end
$$;

-- ---------------------------------------------------------
-- 3. Tambahkan tabel ke Realtime publication jika belum ada.
-- ---------------------------------------------------------

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'attendance_checkins'
  ) then
    execute 'alter publication supabase_realtime add table public.attendance_checkins';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'attendance'
  ) then
    execute 'alter publication supabase_realtime add table public.attendance';
  end if;
end
$$;
