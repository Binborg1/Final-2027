"use client";

import { CircleAlert, Lock } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Logo } from "@/components/ui/Misc";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { MIN_PASSWORD, passwordProblem } from "@/lib/auth/email-sign-in";
import { saveNewPassword } from "./actions";

/** A1b Choose a new password: where a reset link lands, and Settings' "Change password". */
export function NewPasswordCard({ email, after }: { email: string | null; after: string }) {
  const [password, setPassword] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: FormEvent) {
    e.preventDefault();
    const problem = passwordProblem(password);
    setFieldError(problem);
    if (problem) return;
    setError(null);
    start(async () => {
      const result = await saveNewPassword(password);
      if (result.ok) window.location.assign(after);
      else setError(result.message);
    });
  }

  return (
    <div className="frost frost-auth w-full max-w-[472px] rounded-auth border border-white/45 px-11 pt-11 pb-9 shadow-auth max-sm:px-6 max-sm:pt-8 max-sm:pb-7">
      <Logo />
      <h1 className="mt-9 text-hero font-bold">Choose a new password</h1>
      <p className="mt-1.5 text-card-sm font-medium text-ink-2">
        {email ? (
          <>
            For <span className="font-semibold text-ink">{email}</span>. You’ll use it with this email to sign in.
          </>
        ) : (
          "You’ll use it with your email to sign in."
        )}
      </p>

      {error ? (
        <p role="alert" className="mt-5 flex items-start gap-2.5 rounded-md bg-red-tint px-3.5 py-3 text-body font-medium text-red-ink">
          <CircleAlert aria-hidden size={18} strokeWidth={1.75} className="mt-px shrink-0" />
          {error}
        </p>
      ) : null}

      <form onSubmit={submit} noValidate className="mt-8 flex flex-col gap-3">
        {/* Lets password managers pair the new password with the right account. */}
        {email ? <input type="email" name="username" autoComplete="username" value={email} readOnly hidden /> : null}
        <Field id="new-password" label="New password" hint={`At least ${MIN_PASSWORD} characters`} error={fieldError}>
          <PasswordInput id="new-password" autoComplete="new-password" value={password} invalid={!!fieldError} hasHint onChange={(e) => setPassword(e.target.value)} disabled={pending} />
        </Field>
        <Button type="submit" className="mt-1 h-[50px] w-full" loading={pending}>
          Save password
        </Button>
      </form>

      <div className="mt-7 border-t border-line pt-[18px]">
        <p className="flex items-center justify-center gap-2 text-center text-meta leading-[19px] text-ink-2">
          <Lock aria-hidden size={16} strokeWidth={1.5} className="shrink-0" />
          Your password is stored encrypted. Funza never sees it.
        </p>
      </div>
    </div>
  );
}
