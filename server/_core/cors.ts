const defaultAllowedOrigins = new Set([
  "http://localhost:3000",
  "http://localhost:8081",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:8081",
  "https://sufretapp-ed9iastw.manus.space",
]);

function configuredOrigins() {
  return new Set(
    (process.env.CORS_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

export function isAllowedCorsOrigin(origin: string | undefined) {
  if (!origin) return false;
  const configured = configuredOrigins();
  if (configured.size > 0) return configured.has(origin);
  if (defaultAllowedOrigins.has(origin)) return true;
  return /^https:\/\/8081-[a-z0-9-]+\.manus\.computer$/i.test(origin);
}
