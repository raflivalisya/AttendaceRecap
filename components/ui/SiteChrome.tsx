"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const immersivePrefixes = ["/admin", "/asdos", "/student", "/presensi"];

export default function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const immersive = immersivePrefixes.some((prefix) => pathname.startsWith(prefix));

  if (immersive) {
    return <>{children}</>;
  }

  return (
    <>
      <a className="skip-link" href="#main-content">
        Lewati ke konten utama
      </a>

      <header className="site-header">
        <div className="shell nav-wrap">
          <Link href="/rekap" className="brand" aria-label="AttendanceRecap — Beranda rekap">
            <span className="brand-mark" aria-hidden="true">AR</span>
            <span className="brand-copy">
              <strong>AttendanceRecap</strong>
              <small>Portal Akademik</small>
            </span>
          </Link>

          <nav className="main-nav" aria-label="Navigasi utama">
            <Link
              href="/rekap"
              aria-current={pathname.startsWith("/rekap") ? "page" : undefined}
            >
              Rekap
            </Link>
            <Link href="/student/login">Mahasiswa</Link>
            <Link href="/asdos/login">Asdos</Link>
            <Link href="/admin">Admin / Dosen</Link>
          </nav>
        </div>
      </header>

      <main id="main-content" tabIndex={-1}>
        {children}
      </main>

      <footer className="site-footer">
        <div className="shell site-footer-inner">
          <div>
            <strong>AttendanceRecap</strong>
            <span>Sistem akademik, presensi, nilai, dan asistensi.</span>
          </div>
          <span>Universitas Teknokrat Indonesia</span>
        </div>
      </footer>
    </>
  );
}
