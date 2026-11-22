import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Travel Laju Jagat | Perjalanan Antar Kota",
  description: "Cari perjalanan shuttle antar kota bersama Travel Laju Jagat.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
