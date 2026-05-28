import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "REMINDRA",
  description: "Cloud-ready AHASS retention and follow-up dashboard."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
