import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClinicalToolsNav } from "@/components/ClinicalToolsNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Azure Mind — Referral Engine",
    template: "%s | Azure Mind",
  },
  description: "Internal referral system for clinical intake and patient onboarding.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <ClinicalToolsNav />
        {children}
      </body>
    </html>
  );
}
