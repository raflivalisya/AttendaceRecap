import type { ReactNode } from "react";
import "./rekap-ux.css";

export default function RekapLayout({ children }: { children: ReactNode }) {
  return <div className="rekap-modern">{children}</div>;
}
