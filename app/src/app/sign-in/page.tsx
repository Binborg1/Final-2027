import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth/redirect";
import { currentTeacher } from "@/lib/auth/teacher";
import { SignInCard, type SignInMode, type SignInNotice } from "./SignInCard";

export const metadata: Metadata = { title: "Sign in" };

const NOTICES: Record<string, SignInNotice> = {
  cancelled: { tone: "info", text: "Google sign-in was cancelled. Try again when you’re ready." },
  expired: { tone: "bad", text: "That email link has expired or was already used. Sign in, or choose “Forgot password?” for a new one." },
  "other-browser": { tone: "bad", text: "Sign-in started in another browser. Please try again here." },
  failed: { tone: "bad", text: "Sign-in didn’t work. Please try again." },
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : "/");
  const current = await currentTeacher().catch(() => null);
  if (current) redirect(current.teacher.setupDone ? next : "/setup");

  const error = typeof sp.error === "string" ? NOTICES[sp.error] ?? NOTICES.failed : null;
  const notice = error ?? (sp["signed-out"] ? { tone: "ok" as const, text: "You’re signed out. See you next time." } : null);
  const mode: SignInMode = sp.mode === "create" || sp.mode === "forgot" ? sp.mode : "sign-in";
  return (
    <main className="flex min-h-dvh items-center justify-center px-3 py-6 sm:px-6">
      <SignInCard next={next} notice={notice} initialMode={mode} />
    </main>
  );
}
