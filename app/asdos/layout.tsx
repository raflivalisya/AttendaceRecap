import type { ReactNode } from "react";
import "./asdos-ux.css";

export default function AsdosLayout({ children }: { children: ReactNode }) {
  return <div className="asdos-app">{children}</div>;
}
