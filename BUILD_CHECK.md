# Build & Verification Report

Tanggal verifikasi: 28 September 2026 (Asia/Jakarta)

## Source of truth

Paket ini dibuat hanya dari `AttendaceRecap(3).zip` yang diberikan pada percakapan ini. Tidak ada file proyek lama yang dipakai sebagai basis perubahan.

## Pemeriksaan yang selesai

- PASS — 105 file `.ts`/`.tsx` berhasil diparse dengan TypeScript compiler API tanpa syntax error.
- PASS — 0 import lokal relatif yang mengarah ke file yang hilang.
- PASS — `package.json` dan `package-lock.json` valid JSON.
- PASS — pemeriksaan diagnostic TypeScript tanpa dependency tidak menemukan duplicate identifier / redeclaration / syntax-level diagnostic.
- PASS — referensi script presensi legacy yang sudah dihapus tidak tersisa pada source aktif.
- PASS — `.gitignore` mengecualikan `.env*` dan tetap mengizinkan `.env.example`.
- PASS — ZIP final tidak menyertakan `.env.local`, `node_modules`, `.next`, log, atau `tsconfig.tsbuildinfo`.

## Status build Next.js

`npm run build` sudah dicoba di sandbox ini, tetapi dependency belum dapat dipasang karena koneksi DNS sandbox ke `registry.npmjs.org` gagal dengan `EAI_AGAIN`. Percobaan offline juga tidak dapat menyelesaikan dependency karena cache npm tidak lengkap (termasuk `zod-validation-error` dan paket SheetJS/XLSX).

Akibatnya, `npm run build` berhenti pada `next: not found` karena executable Next.js belum tersedia di `node_modules`. Ini adalah **build verification blocked by environment/dependency availability**, bukan klaim bahwa build source sudah lulus compiler penuh.

Pada mesin/CI yang memiliki akses internet, jalankan:

```bash
npm ci
npm run build
```

Opsional setelah dependency tersedia:

```bash
npm run lint
```

## Database migration

Urutan instalasi yang digunakan untuk versi final:

1. `supabase/schema.sql`
2. `supabase/lecturer-management.sql`
3. `supabase/asdos-module.sql`
4. `supabase/production-hardening.sql`
5. `supabase/dashboard-realtime.sql`

Lihat `README.md` untuk environment variables, deployment checklist, panduan izin lokasi iPhone/Android, health check, backup, audit/recovery, dan fitur presensi produksi.
