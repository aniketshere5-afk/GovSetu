import { startLogin } from "@/const";

/**
 * Use the demo role-picker instead of OAuth when explicitly asked
 * (VITE_DEMO_AUTH=1) or when a production build has no OAuth portal configured
 * (a standalone SIH demo deployment).
 */
export const DEMO_AUTH =
  import.meta.env.VITE_DEMO_AUTH === "1" ||
  (import.meta.env.PROD && !import.meta.env.VITE_OAUTH_PORTAL_URL);

/**
 * Begin sign-in. In a normal deployment this starts the OAuth flow; in the
 * hosted SIH demo it sends the visitor to the role picker instead.
 */
export function signInEntry() {
  if (DEMO_AUTH) {
    window.location.href = "/demo-login";
    return;
  }
  startLogin();
}
