const isProduction = process.env.NODE_ENV === "production";

/** True when there is no OAuth portal configured — i.e. a standalone demo. */
export const DEMO_MODE = !process.env.OAUTH_SERVER_URL || process.env.DEMO_AUTH === "1";

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "setugov",
  // A stable fallback so session cookies still verify on a demo deployment that
  // has no JWT_SECRET set. Set JWT_SECRET for any real deployment.
  cookieSecret: process.env.JWT_SECRET || "setugov-demo-insecure-session-secret",
  databaseUrl: process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.MYSQL_PUBLIC_URL || "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID || "dev-admin",
  isProduction,
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
