import Link from "next/link";

export default function NotFound() {
  return (
    <main className="global-state-page">
      <div className="global-state-card">
        <div className="global-state-icon" aria-hidden="true">404</div>
        <h1>Halaman tidak ditemukan</h1>
        <p>Tautan mungkin sudah tidak berlaku atau alamat yang dibuka tidak tepat.</p>
        <Link className="btn btn-primary" href="/">Kembali ke Beranda</Link>
      </div>
    </main>
  );
}
