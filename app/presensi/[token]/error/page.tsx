export const dynamic =
  "force-dynamic";

export default async function PresensiErrorPage({
  searchParams,
}: {
  searchParams: Promise<{
    message?:
      | string
      | string[];
  }>;
}) {
  const query =
    await searchParams;

  const message =
    Array.isArray(
      query.message
    )
      ? query.message[0]
      : query.message ??
        "Presensi tidak tersedia.";

  return (
    <section className="page">
      <div
        className="shell"
        style={{
          width:
            "100%",

          maxWidth:
            600,

          margin:
            "0 auto",
        }}
      >
        <div className="panel">
          <div className="panel-body">
            <h2>
              Presensi Tidak Tersedia
            </h2>

            <p>
              {message}
            </p>

            <p className="muted">
              Scan QR terbaru yang sedang
              tampil di layar dosen.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}