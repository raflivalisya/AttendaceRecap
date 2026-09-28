import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ code?: string | string[] }>;
};

export default async function LegacyPresensiPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const query = await searchParams;
  const code = Array.isArray(query.code) ? query.code[0] : query.code ?? "";

  if (token && code) {
    redirect(`/api/presensi/scan/${encodeURIComponent(token)}?code=${encodeURIComponent(code)}`);
  }

  return (
    <main className="global-state-page">
      <div className="global-state-card">
        <div className="global-state-icon" aria-hidden="true">QR</div>
        <h1>Scan QR Presensi Terbaru</h1>
        <p>Link presensi langsung tidak dapat dipakai tanpa kode QR dinamis yang masih aktif.</p>
      </div>
    </main>
  );
}
