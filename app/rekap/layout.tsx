import type { ReactNode } from "react";
import SiteChrome from "@/components/ui/SiteChrome";
import "./rekap-ux.css";

export default function RekapLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <SiteChrome>
      <div className="rekap-modern">{children}</div>
    </SiteChrome>
  );
}
