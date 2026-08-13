export function isPlatformAdmin(email: string) {
  const admin = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
  if (!admin) return false;
  return email.trim().toLowerCase() === admin;
}
