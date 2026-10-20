import type { Metadata } from "next";
import { DM_Sans, DM_Mono } from "next/font/google";
import "./globals.css";

const sans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans", weight: ["400", "500", "600", "700"] });
const mono = DM_Mono({ subsets: ["latin"], variable: "--font-dm-mono", weight: ["400"] });

export const metadata: Metadata = {
  title: { default: "ocademy chat", template: "%s · ocademy chat" },
  description: "Follow-up otomatis dan template pesan untuk percakapan pelanggan.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
