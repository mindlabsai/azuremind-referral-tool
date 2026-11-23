import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Texlex · One Surface",
  description: "Texlex Experience Lab. Fictional data only. Not for clinical use.",
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return <div className={inter.className}>{children}</div>;
}
