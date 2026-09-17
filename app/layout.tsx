import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DIESNATALIS INFORMATIKA 18 — Staff Announcement",
  description: "Pengumuman Staff DIESNATALIS INFORMATIKA 18",
  themeColor: "#E099F8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}