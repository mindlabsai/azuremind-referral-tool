"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isAdminStaffEmail } from "@/lib/auth/staff-accounts";

const LINKS = [
  { href: "/", label: "Referral", match: (path: string) => path === "/", admin: true },
  {
    href: "/referral-inbox",
    label: "Inbox",
    match: (path: string) => path.startsWith("/referral-inbox"),
    admin: true,
  },
  {
    href: "/workspace",
    label: "Workspace",
    match: (path: string) => path.startsWith("/workspace"),
    admin: false,
  },
  {
    href: "/asd-engine/report",
    label: "ASD",
    match: (path: string) => path.startsWith("/asd-engine"),
    admin: false,
  },
  {
    href: "/adhd-engine/report",
    label: "ADHD",
    match: (path: string) => path.startsWith("/adhd-engine"),
    admin: false,
  },
  {
    href: "/reports",
    label: "Reports",
    match: (path: string) => path.startsWith("/reports"),
    admin: false,
  },
] as const;

export function ClinicalToolsNav() {
  const pathname = usePathname() ?? "/";
  const [adminOnly, setAdminOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!cancelled) setAdminOnly(isAdminStaffEmail(user?.email));
      } catch {
        if (!cancelled) setAdminOnly(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/parent-screen") ||
    pathname.startsWith("/studio")
  ) {
    return null;
  }

  // Report desks / other-reports use compact in-page workspace links instead of the tall global bar.
  if (
    pathname.startsWith("/asd-engine/report") ||
    pathname.startsWith("/adhd-engine/report") ||
    pathname.startsWith("/reports")
  ) {
    return null;
  }

  const links = adminOnly ? LINKS.filter((link) => link.admin) : LINKS;

  return (
    <nav aria-label="Texlex" className="texlex-global-nav">
      <span className="texlex-global-mark">Texlex</span>
      {links.map((link) => {
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
