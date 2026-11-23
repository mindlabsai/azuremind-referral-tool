"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isAdminStaffEmail } from "@/lib/auth/staff-accounts";
import { cn } from "@/lib/utils";

const ALL_LINKS = [
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

/** Compact in-header links — draft autosave keeps work when switching tools. */
export function TexlexWorkspaceLinks({
  className,
  density = "header",
}: {
  className?: string;
  density?: "header" | "bar";
}) {
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

  const links = adminOnly ? ALL_LINKS.filter((link) => link.admin) : ALL_LINKS;

  return (
    <nav
      aria-label="Texlex workspace"
      className={cn(
        "flex flex-wrap items-center",
        density === "header" ? "gap-x-4 gap-y-1" : "gap-x-5 gap-y-1",
        className
      )}
    >
      {links.map((link) => {
        const active = link.match(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "border-0 bg-transparent text-[15px] font-medium tracking-[0.02em] transition-colors",
              active ? "text-[#f4f8fc]" : "text-[#849aaf] hover:text-[#eaf1f8]"
            )}
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
