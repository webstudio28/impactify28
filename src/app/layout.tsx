import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { getLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "latin-ext", "cyrillic"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Impact28 — Simple SMS campaigns",
  description: "Minimal SMS marketing for ecommerce.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let lang: string = routing.defaultLocale;
  try {
    lang = await getLocale();
  } catch {
    /* e.g. routes without intl context */
  }

  return (
    <html lang={lang} className={inter.variable}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
