"use client";

import { ArrowLeft, CircleAlert, CircleCheck, Info, Lock, MailCheck, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { GoogleG, Logo } from "@/components/ui/Misc";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { authMessage, EMAIL_PATTERN, MIN_PASSWORD, passwordProblem, type SignInMode } from "@/lib/auth/email-sign-in";
import { browserClient } from "@/lib/db/browser";
import { cn } from "@/lib/ui/cn";

export type SignInNotice = { tone: "ok" | "info" | "bad"; text: string };
export type { SignInMode };
type Sent = { kind: "confirm" | "reset"; to: string };

const TITLES: Record<SignInMode, string> = { "sign-in": "Sign in to Funza", create: "Create your account", forgot: "Reset your password" };
const SUBTITLES: Record<SignInMode, string> = {
  "sign-in": "For Saskatchewan Grade 10–12 teachers",
  create: "For Saskatchewan Grade 10–12 teachers",
  forgot: "Enter your school email and we’ll send you a link to choose a new password.",
};

/**
 * A1 Sign in: Google first, then email and password, with "Create account" and
 * "Forgot password?" on the same card. The reset link comes back through
 * /auth/confirm and lands on /new-password. Students never sign in.
 */
export function SignInCard({ next, notice, initialMode = "sign-in" }: { next: string; notice: SignInNotice | null; initialMode?: SignInMode }) {
  const [mode, setMode] = useState<SignInMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"google" | "email" | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  const [message, setMessage] = useState<SignInNotice | null>(notice);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const back = (path: string, to = next) => `${window.location.origin}${path}?next=${encodeURIComponent(to)}`;

  function switchTo(to: SignInMode) {
    setMode(to);
    setMessage(null);
    setErrors({});
    setPassword("");
  }

  async function google() {
    setBusy("google");
    setMessage(null);
    const { error } = await browserClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: back("/auth/callback") } });
    if (error) {
      setBusy(null);
      setMessage({ tone: "bad", text: "Google sign-in couldn’t start. Check your connection and try again." });
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const address = email.trim();
    const found: typeof errors = {};
    if (!EMAIL_PATTERN.test(address)) found.email = "Enter your school email address, like name@yourschool.ca.";
    if (mode === "sign-in" && !password) found.password = "Enter your password.";
    if (mode === "create") found.password = passwordProblem(password) ?? undefined;
    setErrors(found);
    if (found.email || found.password) return;

    setMessage(null);
    setBusy("email");
    const auth = browserClient().auth;

    if (mode === "forgot") {
      const { error } = await auth.resetPasswordForEmail(address, { redirectTo: back("/auth/confirm", "/new-password") });
      setBusy(null);
      if (error) setMessage({ tone: "bad", text: authMessage(error, mode) });
      else setSent({ kind: "reset", to: address });
      return;
    }

    if (mode === "create") {
      const { data, error } = await auth.signUp({ email: address, password, options: { emailRedirectTo: back("/auth/confirm") } });
      if (error) {
        setBusy(null);
        setMessage({ tone: "bad", text: authMessage(error, mode) });
      } else if (data.session) {
        // "Confirm email" is off: the account is ready. Teacher pages send a new teacher to setup.
        window.location.assign(next);
      } else {
        setBusy(null);
        setSent({ kind: "confirm", to: address });
      }
      return;
    }

    const { error } = await auth.signInWithPassword({ email: address, password });
    if (error) {
      setBusy(null);
      setMessage({ tone: "bad", text: authMessage(error, mode) });
    } else {
      window.location.assign(next);
    }
  }

  return (
    <div className="frost frost-auth w-full max-w-[472px] rounded-auth border border-white/45 px-11 pt-11 pb-9 shadow-auth max-sm:px-6 max-sm:pt-8 max-sm:pb-7">
      <Logo />
      {sent ? (
        <div className="mt-9 flex flex-col gap-4" role="status">
          <span className="flex size-12 items-center justify-center rounded-md bg-sage-tint text-sage-ink">
            <MailCheck aria-hidden size={24} strokeWidth={1.6} />
          </span>
          <h1 className="text-hero font-bold">Check your email</h1>
          <p className="text-card-sm font-medium text-ink-2">
            {sent.kind === "confirm" ? (
              <>
                Open the link we sent to <span className="font-semibold text-ink">{sent.to}</span> to confirm your account. Already have one? Sign in instead.
              </>
            ) : (
              <>
                If there’s a Funza account for <span className="font-semibold text-ink">{sent.to}</span>, we sent it a link to choose a new password. It works once.
              </>
            )}
          </p>
          <Button variant="secondary" icon={ArrowLeft} className="mt-2 w-full" onClick={() => { setSent(null); switchTo("sign-in"); }}>
            Back to sign in
          </Button>
        </div>
      ) : (
        <>
          <h1 className="mt-9 text-hero font-bold">{TITLES[mode]}</h1>
          <p className="mt-1.5 text-card-sm font-medium text-ink-2">{SUBTITLES[mode]}</p>

          {message ? <Notice notice={message} /> : null}

          {mode !== "forgot" ? (
            <>
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
            </>
          ) : null}

          <form onSubmit={submit} noValidate className={cn("flex flex-col gap-3", mode === "forgot" ? "mt-8" : "mt-[22px]")}>
            <Field id="email" label="School email" error={errors.email}>
              <Input id="email" type="email" inputMode="email" autoComplete={mode === "create" ? "email" : "username"} placeholder="name@yourschool.ca" value={email} invalid={!!errors.email} onChange={(e) => setEmail(e.target.value)} disabled={busy !== null} />
            </Field>

            {mode !== "forgot" ? (
              <Field id="password" label="Password" hint={mode === "create" ? `At least ${MIN_PASSWORD} characters` : undefined} error={errors.password}>
                <PasswordInput
                  id="password"
                  autoComplete={mode === "create" ? "new-password" : "current-password"}
                  value={password}
                  invalid={!!errors.password}
                  hasHint={mode === "create"}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy !== null}
                />
              </Field>
            ) : null}

            {mode === "sign-in" ? (
              <button type="button" onClick={() => switchTo("forgot")} disabled={busy !== null} className="self-end rounded-sm text-meta font-semibold text-accent-ink hover:underline focus-visible:outline-2 focus-visible:outline-accent pointer-coarse:min-h-11">
                Forgot password?
              </button>
            ) : null}

            <Button type="submit" variant="secondary" icon={mode === "forgot" ? Send : undefined} className="mt-1 h-[50px] w-full" loading={busy === "email"} disabled={busy !== null}>
              {mode === "sign-in" ? "Sign in" : mode === "create" ? "Create account" : "Email me a reset link"}
            </Button>
          </form>

          <p className="mt-5 text-center text-body font-medium text-ink-2">
            {mode === "sign-in" ? (
              <>
                New to Funza? <ModeLink onClick={() => switchTo("create")} disabled={busy !== null}>Create an account</ModeLink>
              </>
            ) : mode === "create" ? (
              <>
                Already have an account? <ModeLink onClick={() => switchTo("sign-in")} disabled={busy !== null}>Sign in</ModeLink>
              </>
            ) : (
              <ModeLink onClick={() => switchTo("sign-in")} disabled={busy !== null}>Back to sign in</ModeLink>
            )}
          </p>
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

function ModeLink({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="rounded-sm font-semibold text-accent-ink hover:underline focus-visible:outline-2 focus-visible:outline-accent pointer-coarse:min-h-11">
      {children}
    </button>
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
