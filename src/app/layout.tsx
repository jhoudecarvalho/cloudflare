import type { Metadata } from "next";
import "./globals.css";

// Evita HTML estático com hashes webpack antigos após novo build
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Cloudflare Hub — CDWTech",
  description: "Dashboard Cloudflare: analytics, DNS e gestão de domínios",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
