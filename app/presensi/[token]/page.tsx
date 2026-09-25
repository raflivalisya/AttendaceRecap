import PresensiForm from "./presensi-form";

export default async function PresensiPage(
  props: {
    params: Promise<{
      token: string;
    }>;
  }
) {
  const { token } =
    await props.params;

  return (
    <PresensiForm token={token} />
  );
}