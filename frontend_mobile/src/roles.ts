import { AppRole } from "./types";

export type MobileAppRole = AppRole | "site_manager";

function normalizeRole(role: string | null | undefined): string {
  return role?.trim().toLowerCase().replace(/[\s-]+/g, "_") ?? "";
}

export function isSiteManagerRole(role: string | null | undefined): boolean {
  const normalizedRole = normalizeRole(role);
  return normalizedRole === AppRole.LINE_MANAGER || normalizedRole === AppRole.SITE_MANAGER || normalizedRole === "site_manager" || normalizedRole === "sitemanager";
}

export function isCitizenRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === AppRole.CITIZEN;
}
