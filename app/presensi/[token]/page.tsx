import {
  redirect,
} from "next/navigation";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

export default async function PresensiPage({
  params,
  searchParams,
}: {
  params: Promise<{
    token: string;
  }>;

  searchParams: Promise<{
    code?:
      | string
      | string[];
  }>;
}) {
  const {
    token,
  } =
    await params;

  const query =
    await searchParams;

  const code =
    Array.isArray(
      query.code
    )
      ? query.code[0]
      : query.code ??
        "";

  if (!code) {
    redirect(
      `/presensi/${encodeURIComponent(
        token
      )}/error?message=${encodeURIComponent(
        "QR tidak valid. Scan QR terbaru."
      )}`
    );
  }

  /*
   * Route handler berikut
   * akan:
   *
   * 1. validasi QR
   * 2. buat ticket
   * 3. simpan HttpOnly cookie
   * 4. redirect ke /checkin
   */
  redirect(
    `/api/presensi/scan/${encodeURIComponent(
      token
    )}?code=${encodeURIComponent(
      code
    )}`
  );
}