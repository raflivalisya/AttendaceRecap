import PresensiForm
  from "./presensi-form";

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
  const { token } =
    await params;

  const query =
    await searchParams;

  const code =
    Array.isArray(
      query.code
    )
      ? query.code[0]
      : query.code ?? "";

  return (
    <PresensiForm
      token={token}
      qrCode={code}
    />
  );
}