# AttendanceRecap — Next.js + Supabase

AttendanceRecap adalah aplikasi rekap akademik dan presensi untuk **Super Admin, Dosen, Asisten Dosen, dan Mahasiswa**. Versi ini sudah mencakup absensi H/I/S/A, penilaian, QR presensi berbasis lokasi, monitoring realtime, audit log, recovery, backup, health check, serta UI responsif desktop/mobile.

## Fitur produksi

- Multi kelas/mata kuliah, mahasiswa, pertemuan, komponen nilai, bobot, dan publikasi nilai.
- **Autosave + unsaved changes** untuk absensi/nilai Admin-Dosen serta absensi/rekap kegiatan Asdos; tombol simpan manual tetap tersedia.
- **Periode rekap Asdos lintas perangkat** melalui `user_preferences`, dengan localStorage hanya sebagai fallback.
- **Presensi production hardening**: QR berotasi, tiket check-in singkat, validasi lokasi/radius/akurasi, pembatasan percobaan, proteksi satu perangkat/satu mahasiswa, dan panduan izin lokasi iPhone/iPad Safari serta Android Chrome.
- **Live QR Participant Counter**, monitoring realtime/polling, dan **Waiting Students View**.
- **System Settings** untuk lokasi kampus, radius, akurasi GPS, refresh QR, masa berlaku tiket, dan pesan bantuan.
- **Global loading/error/offline UI** dan mobile hardening untuk Admin/Dosen.
- **Audit Log + Recovery** untuk data inti (recovery hanya Super Admin dan setiap recovery kembali tercatat).
- **Health Check + Backup JSON** melalui halaman Sistem Super Admin.

## 1. Persyaratan

- Node.js 20+ (Node 22 direkomendasikan).
- npm.
- Project Supabase.

## 2. Instalasi

```bash
npm ci
```

Salin `.env.example` menjadi `.env.local`, lalu isi semua value:

```env
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxx
SUPABASE_SERVICE_ROLE_KEY=your_server_only_service_role_key
QR_SIGNING_SECRET=replace_with_at_least_32_random_characters
```

> `.env.local` sudah di-ignore Git dan **jangan pernah di-commit**. Service role key dan QR signing secret adalah server-only secret.

## 3. Database / migration

Untuk database baru, jalankan SQL berikut berurutan melalui **Supabase → SQL Editor**:

1. `supabase/schema.sql`
2. `supabase/lecturer-management.sql`
3. `supabase/asdos-module.sql`
4. `supabase/production-hardening.sql`
5. `supabase/dashboard-realtime.sql`

Untuk project lama, jalankan **`supabase/production-hardening.sql`** setelah `schema.sql`, `lecturer-management.sql`, dan `asdos-module.sql`. Setelah itu `dashboard-realtime.sql` boleh dijalankan ulang agar policy realtime lama ikut tersinkron.

`production-hardening.sql` menambahkan/merapikan:

- `attendance_sessions`
- `attendance_checkins`
- `attendance_checkin_attempts`
- `user_preferences`
- `system_settings`
- `audit_logs` + snapshot trigger
- RLS untuk sesi/check-in
- publication Supabase Realtime untuk monitoring presensi

## 4. Membuat Super Admin

Buat user pada **Authentication → Users**, lalu pastikan `admin_profiles.role = 'super_admin'` sesuai schema/migration project. Jika profile belum ada, buat menggunakan pola SQL yang sesuai dengan kolom `admin_profiles` pada `schema.sql`/`lecturer-management.sql`.

## 5. Menjalankan lokal

```bash
npm run dev
```

URL utama:

- Rekap publik: `http://localhost:3000/rekap`
- Admin / Dosen: `http://localhost:3000/admin`
- Asdos: `http://localhost:3000/asdos`

## 6. Checklist produksi sebelum dipakai di kelas

1. Jalankan seluruh migration, terutama `production-hardening.sql`.
2. Isi keempat environment variable pada platform hosting.
3. Deploy menggunakan HTTPS. Browser mobile membutuhkan secure context untuk geolocation produksi.
4. Login sebagai Super Admin → **Sistem**.
5. Atur titik kampus, radius, maksimal akurasi GPS, interval QR, dan durasi tiket.
6. Jalankan **Health Check** sampai semua pemeriksaan penting berstatus Healthy.
7. Buat **Backup JSON** sebelum perubahan database besar.
8. Uji QR dari minimal satu iPhone/iPad Safari dan satu Android Chrome menggunakan jaringan/perangkat nyata.

## 7. Alur izin lokasi mahasiswa

Halaman check-in menampilkan panduan langsung. Ringkasnya:

- **iPhone/iPad Safari**: aktifkan Location Services, izinkan Safari Websites saat digunakan, dan aktifkan Precise Location. Jika pernah ditolak, ubah izin lokasi situs lalu scan ulang QR.
- **Android Chrome**: Settings → Apps → Chrome → Permissions → Location → Allow while using; aktifkan precise location. Pastikan izin situs Chrome untuk AttendanceRecap adalah Allow.

Presensi akan ditolak jika lokasi berada di luar radius, akurasi GPS terlalu buruk, tiket/QR kedaluwarsa, mahasiswa sudah check-in, atau perangkat sudah dipakai untuk mahasiswa lain pada pertemuan yang sama.

## 8. Audit & recovery

Super Admin dapat membuka **Audit** untuk melihat snapshot sebelum/sesudah perubahan. Tombol **Pulihkan perubahan** tersedia hanya untuk operasi/tabel yang memiliki snapshot yang cukup. Recovery bukan pengganti backup database penuh; gunakan backup Supabase juga untuk disaster recovery skala besar.

## 9. Build & quality check

Di mesin yang memiliki dependency terpasang:

```bash
npm run lint
npm run build
```

Lihat `BUILD_CHECK.md` pada paket ini untuk status verifikasi yang dijalankan saat paket final dibuat.
