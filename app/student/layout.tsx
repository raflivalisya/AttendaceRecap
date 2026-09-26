import type { ReactNode } from "react";
import "./student.css";

export default function StudentLayout({ children }: { children: ReactNode }) {
  return <div className="student-app">{children}</div>;
}
