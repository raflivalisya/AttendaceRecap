import type { Metadata } from "next";
import "./globals.css";
import "./uiux-overhaul.css";
import SiteChrome from "@/components/ui/SiteChrome";

export const metadata: Metadata = {
  title: {
    default: "AttendanceRecap",
    template: "%s · AttendanceRecap",
  },
  description:
    "Portal akademik untuk rekap kehadiran, nilai, jadwal, mahasiswa, dosen, dan asisten dosen.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
