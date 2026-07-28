"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Referral Engine", match: (path: string) => path === "/" },
  {
    href: "/asd-engine",
    label: "ASD Engine",
    match: (path: string) => path.startsWith("/asd-engine"),
  },
  {
    href: "/adhd-engine/report",
    label: "ADHD Engine",
    match: (path: string) => path.startsWith("/adhd-engine"),
  },
] as const;

export function ClinicalToolsNav() {
  const pathname = usePathname() ?? "/";

  if (pathname.startsWith("/login")) return null;

  return (
    <nav
      aria-label="Clinical tools"
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 8,
        padding: "8px 16px",
        borderBottom: "1px solid #e2e8f0",
        background: "#f8fafc",
        fontSize: 13,
      }}
    >
      <span style={{ color: "#64748b", marginRight: 4, fontWeight: 600 }}>
        Tools
      </span>
      {LINKS.map((link) => {
        const active = link.match(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            style={{
              padding: "4px 10px",
              borderRadius: 6,
              textDecoration: "none",
              color: active ? "#0f172a" : "#334155",
              background: active ? "#e2e8f0" : "transparent",
              fontWeight: active ? 600 : 500,
            }}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
