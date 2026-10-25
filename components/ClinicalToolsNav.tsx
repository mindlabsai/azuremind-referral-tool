"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Referral", match: (path: string) => path === "/" },
  {
    href: "/workspace",
    label: "Workspace",
    match: (path: string) => path.startsWith("/workspace"),
  },
  {
    href: "/asd-engine/report",
    label: "ASD",
    match: (path: string) => path.startsWith("/asd-engine"),
  },
  {
    href: "/adhd-engine/report",
    label: "ADHD",
    match: (path: string) => path.startsWith("/adhd-engine"),
  },
  {
    href: "/reports",
    label: "Reports",
    match: (path: string) => path.startsWith("/reports"),
  },
] as const;

export function ClinicalToolsNav() {
  const pathname = usePathname() ?? "/";

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/parent-screen") ||
    pathname.startsWith("/studio")
  ) {
    return null;
  }

  return (
    <nav aria-label="Texlex" className="texlex-global-nav">
      <span className="texlex-global-mark">Texlex</span>
      {LINKS.map((link) => {
        const active = link.match(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            className="texlex-global-link"
            style={{
              color: active ? "#eaf1f8" : "#849aaf",
              fontWeight: active ? 700 : 600,
              borderBottomColor: active ? "#9fc3f2" : "transparent",
            }}
            onClick={(event) => {
              if (link.href === "/" && pathname === "/") {
                event.preventDefault();
                window.dispatchEvent(new Event("texlex-open-referral-upload"));
              }
            }}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
