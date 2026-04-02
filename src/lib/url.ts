/**
 * Returns the application base URL derived from environment variables.
 * Priority: NEXTAUTH_URL > VERCEL_URL (with https://) > localhost fallback.
 */
export function getAppBaseUrl(): string {
  return (
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000")
  );
}
