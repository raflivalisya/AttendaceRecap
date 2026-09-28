import type { ReactNode } from "react";

export default function PresensiLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main id="main-content" className="presensi-route">
      {children}
    </main>
  );
}