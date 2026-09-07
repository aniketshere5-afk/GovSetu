import { startLogin } from "@/const";

/** Whether the hosted demo role-picker is enabled (set at build time). */
export const DEMO_AUTH = import.meta.env.VITE_DEMO_AUTH === "1";

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
