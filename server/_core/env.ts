const isProduction = process.env.NODE_ENV === "production";

/** True when there is no OAuth portal configured — i.e. a standalone demo. */
export const DEMO_MODE = !process.env.OAUTH_SERVER_URL || process.env.DEMO_AUTH === "1";

// Dashboard env-var UIs (Railway included) will silently keep a trailing
// newline or space if a value was copy-pasted from a terminal/.env file —
// the platform never rejects it, but the literal extra byte makes the key
// invalid wherever it's actually used. Trim defensively so that class of
// mistake can't cause a cryptic "API key not valid" from the provider.
const trimmed = (value: string | undefined) => value?.trim() ?? "";

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "setugov",
  // A stable fallback so session cookies still verify on a demo deployment that
  // has no JWT_SECRET set. Set JWT_SECRET for any real deployment.
  cookieSecret: process.env.JWT_SECRET || "setugov-demo-insecure-session-secret",
  databaseUrl: process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.MYSQL_PUBLIC_URL || "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID || "dev-admin",
  isProduction,
  forgeApiUrl: trimmed(process.env.BUILT_IN_FORGE_API_URL),
  forgeApiKey: trimmed(process.env.BUILT_IN_FORGE_API_KEY),
  // Portable fallbacks so the assistant also works on a plain deployment (or
  // local dev) that has no Manus Forge proxy configured — any real Anthropic
  // or Gemini key works here.
  anthropicApiKey: trimmed(process.env.ANTHROPIC_API_KEY),
  anthropicModel: trimmed(process.env.ANTHROPIC_MODEL) || "claude-3-5-sonnet-20241022",
  geminiApiKey: trimmed(process.env.GEMINI_API_KEY),
  geminiModel: trimmed(process.env.GEMINI_MODEL) || "gemini-3.6-flash",
};
