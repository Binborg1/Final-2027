"use server";

import { passwordProblem } from "@/lib/auth/email-sign-in";
import { teacherForAction } from "@/lib/auth/teacher";
import type { ActionResult } from "@/lib/teachers/actions";

/**
 * Saves a new password for the signed-in teacher: after a reset link (which signs
 * them in through /auth/confirm), or from Settings. The rule is checked again
 * here, and Supabase Auth enforces its own minimum as well.
 */
export async function saveNewPassword(password: unknown): Promise<ActionResult> {
  const current = await teacherForAction();
  if (!current) return { ok: false, message: "Your session has ended. Use “Forgot password?” on the sign-in page for a new link." };
  if (typeof password !== "string") return { ok: false, message: "Enter a new password." };
  const problem = passwordProblem(password);
  if (problem) return { ok: false, message: problem };

  const { error } = await current.supabase.auth.updateUser({ password });
  if (!error) return { ok: true };
  if (error.code === "same_password") return { ok: false, message: "That’s your current password. Choose a different one." };
  if (error.code === "weak_password") return { ok: false, message: "Choose a stronger password, with letters and numbers." };
  if (error.code === "reauthentication_needed") return { ok: false, message: "For your security, sign in again before changing your password." };
  console.error("Saving a new password failed:", error.code ?? error.message);
  return { ok: false, message: "Funza couldn’t save the password. Check your connection and try again." };
}
