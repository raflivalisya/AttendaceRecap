"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="id">
      <body>
        <main className="global-state-page">
          <div className="global-state-card">
            <div className="global-state-icon" aria-hidden="true">!</div>
            <h1>Aplikasi tidak dapat dimuat</h1>
            <p>Coba muat ulang. Jika masalah berlanjut, periksa koneksi dan health check sistem.</p>
            <div className="global-state-actions"><button type="button" className="btn btn-primary" onClick={reset}>Muat Ulang</button></div>
          </div>
        </main>
      </body>
    </html>
  );
}
