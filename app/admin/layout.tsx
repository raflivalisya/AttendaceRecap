import type { ReactNode } from "react";
import "./admin-modern.css";

export default function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="admin-modern">{children}</div>;
}
