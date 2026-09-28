# AttendanceRecap — Production Finalization

Release ini memfinalkan UI/UX dan hardening alur presensi berdasarkan source ZIP terbaru.

## Cakupan utama

- Final UI/UX consistency dan responsive behavior untuk Admin/Dosen/Asdos.
- Global loading, error boundary, not-found, offline indicator, dan save-state indicator.
- Presensi production hardening: QR dinamis, server-issued ticket, cookie device server-side, rate limit persisten, akurasi GPS, radius kampus, duplicate/device guard, dan rollback saat write attendance gagal.
- Panduan izin lokasi khusus iPhone/iPad Safari dan Android Chrome langsung pada halaman check-in.
- Autosave + unsaved-change protection untuk presensi/nilai Admin/Dosen dan presensi/rekap Asdos.
- Periode rekap Asdos tersimpan server-side dan sinkron lintas perangkat, dengan localStorage sebagai fallback.
- Live QR participant counter dan Waiting Students View untuk Admin/Dosen/Asdos.
- System Settings untuk lokasi kampus, radius, akurasi GPS, refresh QR, masa ticket, nama aplikasi/kampus, dan support message.
- Health check Super Admin dan backup JSON terkontrol; backup check-in tidak menyertakan device hash, IP hash, atau user-agent.
- Audit snapshots + recovery Super Admin untuk tabel inti, dengan recovery ikut tercatat di audit log.
- Migration `supabase/production-hardening.sql` untuk tabel, RLS, indexes, audit triggers, settings, user preferences, check-in attempts, sessions, dan check-ins.
- Legacy presensi client scripts yang tidak digunakan dihapus untuk mencegah dua alur check-in paralel.
- `.env.local` dikeluarkan dari paket final; `.env.example` menjadi template konfigurasi GitHub/deployment.

## Sebelum deploy

Ikuti `README.md`, jalankan seluruh migration sesuai urutan, isi environment variables dari `.env.example`, lalu jalankan `npm ci && npm run build` pada environment yang dapat mengakses registry npm.
