/**
 * Email and password sign-in, shared by the sign-in card, the new-password page
 * and its Server Function (no browser or server-only imports, so tests load it).
 *
 * The password rule for teacher accounts: Supabase Auth enforces the same
 * minimum (Authentication → Sign In / Providers → Email → minimum password length = 8).
 * The upper limit is bcrypt's: Supabase ignores anything past 72 bytes.
 */

export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 72;

/** A sentence saying what is wrong with the password, or null if it is acceptable. */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  if (new TextEncoder().encode(password).length > MAX_PASSWORD) return `Use at most ${MAX_PASSWORD} characters.`;
  if (password.trim() === "") return "A password can’t be only spaces.";
  return null;
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type SignInMode = "sign-in" | "create" | "forgot";

type AuthFailure = { code?: string; status?: number };

/** Supabase Auth error codes to plain sentences. Provider text never reaches the page. */
export function authMessage(e: AuthFailure, action: SignInMode): string {
  switch (e.code) {
    case "invalid_credentials":
      return "That email and password don’t match. Try again, or reset your password.";
    case "email_not_confirmed":
      return "Confirm your email first: open the link we sent when you created your account.";
    case "user_already_exists":
    case "email_exists":
      return "There’s already a Funza account for that email. Sign in, or reset your password.";
    case "weak_password":
      return `Choose a stronger password, with at least ${MIN_PASSWORD} characters.`;
    case "over_email_send_rate_limit":
      return "Too many emails were sent just now. Wait a few minutes, or continue with Google.";
    case "email_address_not_authorized":
      return "Funza can’t email that address yet. Continue with Google for now.";
    case "email_address_invalid":
    case "validation_failed":
      return "That doesn’t look like an email address. Check it and try again.";
    case "signup_disabled":
      return "New accounts are closed right now. Continue with Google.";
    case "email_provider_disabled":
      return "Email sign-in is turned off right now. Continue with Google.";
  }
  if (e.code === "over_request_rate_limit" || e.status === 429) return "Too many tries just now. Wait a few minutes and try again.";
  if (action === "create") return "Funza couldn’t create the account. Check your connection and try again.";
  if (action === "forgot") return "Funza couldn’t send the email. Check the address and try again.";
  return "Sign-in didn’t work. Check your connection and try again.";
}

