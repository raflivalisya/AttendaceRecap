"use client";

export default function PrintButton() {
  return (
    <div
      className="no-print"
      style={{
        display: "flex",
        justifyContent: "center",
        gap: "12px",
        margin: "20px 0",
        flexWrap: "wrap",
      }}
    >
      <button
        type="button"
        onClick={() => window.print()}
        style={{
          border: "none",
          borderRadius: "10px",
          padding: "12px 20px",
          background: "#123f65",
          color: "#ffffff",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        🖨 Print Rekap Asdos
      </button>

      <button
        type="button"
        onClick={() => window.history.back()}
        style={{
          border: "1px solid #cbd5e1",
          borderRadius: "10px",
          padding: "12px 20px",
          background: "#ffffff",
          color: "#0f172a",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        ← Kembali
      </button>

      <style jsx>{`
        @media print {
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}