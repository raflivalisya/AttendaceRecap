export default function Loading() {
  return (
    <main className="global-state-page" aria-busy="true" aria-live="polite">
      <div className="global-state-card">
        <div className="global-spinner" aria-hidden="true" />
        <h1>Memuat AttendanceRecap</h1>
        <p>Menyiapkan data terbaru…</p>
        <div className="global-skeleton"><span /><span /><span /></div>
      </div>
    </main>
  );
}
