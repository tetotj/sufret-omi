/**
 * Local supervisor access is useful for development previews only.
 * Production builds must use the server-validated owner/admin session.
 */
export function isLocalAdminPreviewAllowed(nodeEnv: string | undefined = process.env.NODE_ENV) {
  return nodeEnv !== "production";
}
