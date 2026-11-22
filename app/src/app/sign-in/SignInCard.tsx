"use client";

import { CircleAlert, CircleCheck, Info, Lock, MailCheck, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { GoogleG, Logo } from "@/components/ui/Misc";
import { browserClient } from "@/lib/db/browser";
import { cn } from "@/lib/ui/cn";

export type SignInNotice = { tone: "ok" | "info" | "bad"; text: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function emailError(e: { code?: string; status?: number }): string {
  if (e.code === "over_email_send_rate_limit" || e.status === 429) return "Too many sign-in emails were sent just now. Wait a few minutes, or continue with Google.";
  if (e.code === "email_address_not_authorized") return "Funza can’t email that address yet. Continue with Google for now.";
  if (e.code === "email_address_invalid" || e.code === "validation_failed") return "That doesn’t look like an email address. Check it and try again.";
  return "Funza couldn’t send the email. Check the address and try again.";
}

/** A1 Sign in: Google first, an email link as the fallback. Students never sign in. */
export function SignInCard({ next, notice }: { next: string; notice: SignInNotice | null }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"google" | "email" | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [message, setMessage] = useState<SignInNotice | null>(notice);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const back = (path: string) => `${window.location.origin}${path}?next=${encodeURIComponent(next)}`;

  async function google() {
    setBusy("google");
    setMessage(null);
    const { error } = await browserClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: back("/auth/callback") } });
    if (error) {
      setBusy(null);
      setMessage({ tone: "bad", text: "Google sign-in couldn’t start. Check your connection and try again." });
    }
  }

  async function sendLink(e: FormEvent) {
    e.preventDefault();
    const address = email.trim();
    if (!EMAIL.test(address)) {
      setFieldError("Enter your school email address, like name@yourschool.ca.");
      return;
    }
    setFieldError(null);
    setMessage(null);
    setBusy("email");
    const { error } = await browserClient().auth.signInWithOtp({ email: address, options: { emailRedirectTo: back("/auth/confirm"), shouldCreateUser: true } });
    setBusy(null);
    if (error) setMessage({ tone: "bad", text: emailError(error) });
    else setSentTo(address);
  }

  return (
    <div className="frost frost-auth w-full max-w-[472px] rounded-auth border border-white/45 px-11 pt-11 pb-9 shadow-auth max-sm:px-6 max-sm:pt-8 max-sm:pb-7">
      <Logo />
      {sentTo ? (
        <div className="mt-9 flex flex-col gap-4" role="status">
          <span className="flex size-12 items-center justify-center rounded-md bg-sage-tint text-sage-ink">
            <MailCheck aria-hidden size={24} strokeWidth={1.6} />
          </span>
          <h1 className="text-hero font-bold">Check your email</h1>
          <p className="text-card-sm font-medium text-ink-2">
            We sent a sign-in link to <span className="font-semibold text-ink">{sentTo}</span>. Open it on this device or your phone. It works once.
          </p>
          <Button variant="secondary" className="mt-2 w-full" onClick={() => setSentTo(null)}>
            Use a different email
          </Button>
        </div>
      ) : (
        <>
          <h1 className="mt-9 text-hero font-bold">Sign in to Funza</h1>
          <p className="mt-1.5 text-card-sm font-medium text-ink-2">For Saskatchewan Grade 10–12 teachers</p>

          {message ? <Notice notice={message} /> : null}

          <Button size="lg" className="mt-8 h-[54px] w-full gap-3 px-6" loading={busy === "google"} disabled={busy !== null} onClick={google}>
            {busy !== "google" ? (
              <span aria-hidden className="flex size-[30px] items-center justify-center rounded-full bg-white">
                <GoogleG size={20} />
              </span>
            ) : null}
            Continue with Google
          </Button>

          <div className="mt-[26px] flex items-center gap-3" aria-hidden>
            <span className="h-px flex-1 bg-ink/12" />
            <span className="text-meta text-ink-2">or</span>
            <span className="h-px flex-1 bg-ink/12" />
          </div>

          <form onSubmit={sendLink} noValidate className="mt-[22px] flex flex-col gap-3">
            <Field id="email" label="School email" error={fieldError}>
              <Input id="email" type="email" inputMode="email" autoComplete="email" placeholder="name@yourschool.ca" value={email} invalid={!!fieldError} onChange={(e) => setEmail(e.target.value)} disabled={busy !== null} />
            </Field>
            <Button type="submit" variant="secondary" icon={Send} className="h-[50px] w-full" loading={busy === "email"} disabled={busy !== null}>
              Email me a sign-in link
            </Button>
          </form>
        </>
      )}

      <div className="mt-7 border-t border-line pt-[18px]">
        <p className="flex items-center justify-center gap-2 text-center text-meta leading-[19px] text-ink-2">
          <Lock aria-hidden size={16} strokeWidth={1.5} className="shrink-0" />
          Students never need an account. Your data stays in Canada.
        </p>
      </div>
    </div>
  );
}

function Notice({ notice }: { notice: SignInNotice }) {
  const Icon = notice.tone === "bad" ? CircleAlert : notice.tone === "ok" ? CircleCheck : Info;
  return (
    <p role={notice.tone === "bad" ? "alert" : "status"} className={cn("mt-5 flex items-start gap-2.5 rounded-md px-3.5 py-3 text-body font-medium", notice.tone === "bad" ? "bg-red-tint text-red-ink" : notice.tone === "ok" ? "bg-sage-tint text-sage-ink" : "bg-amber-tint text-amber-ink")}>
      <Icon aria-hidden size={18} strokeWidth={1.75} className="mt-px shrink-0" />
      {notice.text}
    </p>
  );
}
