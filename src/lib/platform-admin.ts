export function normalizePlatformAdminEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? "";
}

export function getPlatformAdminEmail() {
  const email = process.env.PLATFORM_ADMIN_EMAIL;
  if (!email) {
    throw new Error("PLATFORM_ADMIN_EMAIL environment variable is required");
  }
  return normalizePlatformAdminEmail(email);
}

export function isPlatformAdminEmail(email: string | null | undefined) {
  return normalizePlatformAdminEmail(email) === getPlatformAdminEmail();
}
