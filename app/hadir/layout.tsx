import type { ReactNode } from "react";

export default function HadirLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main id="main-content" className="hadir-route">
      {children}
    </main>
  );
}
