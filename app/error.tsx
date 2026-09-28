"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("APP ERROR:", error);
  }, [error]);

  return (
    <main className="global-state-page">
      <div className="global-state-card">
        <div className="global-state-icon" aria-hidden="true">!</div>
        <h1>Terjadi kendala</h1>
        <p>Data Anda tidak dihapus. Coba muat ulang bagian ini atau kembali ke halaman utama.</p>
        {error.digest && <small>Kode: {error.digest}</small>}
        <div className="global-state-actions">
          <button type="button" className="btn btn-primary" onClick={reset}>Coba Lagi</button>
          <a className="btn btn-secondary" href="/">Beranda</a>
        </div>
      </div>
    </main>
  );
}
