# Rekap Akademik Mahasiswa — Next.js + Supabase

Versi ini mendukung **banyak kelas/mata kuliah**, absensi, mahasiswa, komponen penilaian, bobot, dan rekap nilai.

## Fitur

- Admin dapat menambah kelas/mata kuliah tanpa mengubah source code.
- Form identitas: mata kuliah, kelas, dosen pengampu, jadwal, semester, tahun akademik, jumlah pertemuan, batas kehadiran.
- Pertemuan dibuat otomatis mingguan dari tanggal pertemuan pertama dan tanggal tiap pertemuan tetap dapat diedit.
- Mahasiswa dikelola per kelas.
- Absensi H / I / S / A per pertemuan.
- Komponen nilai default: Tugas 25%, Quiz 15%, UTS 25%, UAS 35%.
- Admin dapat menambah, mengubah, atau menghapus komponen nilai dan bobot.
- Nilai akhir dihitung dari `nilai / nilai maksimum × bobot`.
- Nilai dapat disimpan sebagai data internal atau dipublikasikan pada halaman Rekap.
- Halaman publik dapat memilih kelas dan melihat rekap absensi; nilai hanya terlihat jika diaktifkan admin.

## 1. Instalasi

```bash
npm install
```

Salin `.env.example` menjadi `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxx
```

## 2. Upgrade / membuat database

Buka **Supabase → SQL Editor → New query**, lalu copy seluruh isi:

`supabase/schema.sql`

Klik **Run**.

> Jika Anda sudah memakai versi project sebelumnya, jalankan `schema.sql` terbaru ini juga. Script melakukan upgrade tabel lama dan mempertahankan data absensi yang sudah ada.

## 3. Membuat admin

Buat user terlebih dahulu pada **Authentication → Users → Add user**.

Setelah itu jalankan:

```sql
insert into public.admin_profiles (user_id, display_name)
select id, coalesce(raw_user_meta_data->>'full_name', email)
from auth.users
where email = 'EMAIL_ADMIN_ANDA'
on conflict (user_id) do nothing;
```

## 4. Menjalankan

```bash
npm run dev
```

Buka:

- Rekap publik: `http://localhost:3000/rekap`
- Admin: `http://localhost:3000/admin`

## Alur penggunaan admin

1. Login ke `/admin`.
2. Klik tombol `+` pada **Daftar Kelas**.
3. Isi mata kuliah, kelas, dosen, jadwal, semester, tahun akademik, jumlah pertemuan, dan tanggal pertemuan pertama.
4. Buka tab **Mahasiswa** dan tambahkan mahasiswa.
5. Buka tab **Absensi** untuk mengisi H/I/S/A.
6. Buka tab **Nilai** untuk mengisi Tugas, Quiz, UTS, UAS atau menambah komponen lain.
7. Buka tab **Pengaturan** untuk mengaktifkan **Publikasikan nilai di halaman Rekap**.

## Catatan keamanan

Row Level Security (RLS) digunakan pada Supabase. Pengubahan data hanya dapat dilakukan user yang ada di `admin_profiles`. Nilai yang belum dipublikasikan tidak dapat dibaca oleh user publik melalui policy database.
