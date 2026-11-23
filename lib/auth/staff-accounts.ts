/** Clinic staff accounts that may use password sign-in / reset in the Texlex UI. */
export const STAFF_LOGIN_ACCOUNTS = [
  {
    email: "vishal@azuremind.com.au",
    label: "Vishal",
  },
  {
    email: "admin@azuremind.com.au",
    label: "Admin",
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
