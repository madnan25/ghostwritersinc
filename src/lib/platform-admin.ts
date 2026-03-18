const DEFAULT_PLATFORM_ADMIN_EMAIL = "madnan@alumni.nd.edu";

export function normalizePlatformAdminEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? "";
}

export function getPlatformAdminEmail() {
  return normalizePlatformAdminEmail(
    process.env.PLATFORM_ADMIN_EMAIL ?? DEFAULT_PLATFORM_ADMIN_EMAIL
  );
}

export function isPlatformAdminEmail(email: string | null | undefined) {
  return normalizePlatformAdminEmail(email) === getPlatformAdminEmail();
}
