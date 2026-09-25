import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import type {
  Viewport,
} from "next";

export const metadata: Metadata = {
  title: "Rekap Akademik Mahasiswa",
  description: "Website multi-kelas untuk rekap absensi dan nilai berbasis Next.js dan Supabase",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>
        <header className="site-header">
          <div className="shell nav-wrap">
            <Link href="/rekap" className="brand">
              <span className="brand-mark">RA</span>
              <span>
                <strong>Rekap Akademik</strong>
                <small>Absensi & Nilai</small>
              </span>
            </Link>
            <nav className="main-nav" aria-label="Navigasi utama">
              <Link href="/rekap">Rekap</Link>
              <Link href="/admin">Admin</Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <div className="shell">Rekap Akademik Mahasiswa · Next.js + Supabase</div>
        </footer>
      </body>
    </html>
  );
}
