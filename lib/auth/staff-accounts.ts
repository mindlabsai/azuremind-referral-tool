/** Clinic staff accounts that may use password sign-in / reset in the Texlex UI. */

export type StaffAccess = "clinician" | "admin";

export const STAFF_LOGIN_ACCOUNTS = [
  {
    email: "vishal@azuremind.com.au",
    label: "Vishal",
    access: "clinician" as const,
  },
  {
    email: "admin@azuremind.com.au",
    label: "Admin",
    /** Referral + inbox only — no report desks. */
    access: "admin" as const,
  },
] as const;

export type StaffLoginEmail = (typeof STAFF_LOGIN_ACCOUNTS)[number]["email"];

export function isStaffLoginEmail(email: string): email is StaffLoginEmail {
  const normalised = email.trim().toLowerCase();
  return STAFF_LOGIN_ACCOUNTS.some((account) => account.email === normalised);
}

export function staffAccountLabel(email: string): string {
  const normalised = email.trim().toLowerCase();
  return (
    STAFF_LOGIN_ACCOUNTS.find((account) => account.email === normalised)?.label ??
    normalised
  );
}

export function staffAccessForEmail(email: string | null | undefined): StaffAccess {
  const normalised = (email ?? "").trim().toLowerCase();
  const account = STAFF_LOGIN_ACCOUNTS.find((row) => row.email === normalised);
  return account?.access ?? "clinician";
}

export function isAdminStaffEmail(email: string | null | undefined): boolean {
  return staffAccessForEmail(email) === "admin";
}

/** Paths admin staff may open in the browser (plus public auth routes). */
export function isAdminAllowedPath(pathname: string): boolean {
  if (pathname === "/" || pathname === "") return true;
  if (pathname.startsWith("/referral-inbox")) return true;
  if (pathname === "/login" || pathname.startsWith("/login/")) return true;
  if (pathname.startsWith("/auth/")) return true;
  // Referral intake / inbox APIs the admin desk needs.
  if (pathname.startsWith("/api/referral-intake")) return true;
  if (pathname.startsWith("/api/cron/")) return true;
  if (pathname.startsWith("/api/follow-ups/unsubscribe")) return true;
  if (pathname.startsWith("/api/send-email")) return true;
  return false;
}
