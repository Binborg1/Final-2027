"use client";

import { CircleAlert, Lock } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { AUTH_CARD, AUTH_FOOTER, AUTH_HEADING, Logo } from "@/components/ui/Misc";
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
    <div className={AUTH_CARD}>
      <Logo />
      <h1 className={`mt-5 ${AUTH_HEADING}`}>Choose a new password</h1>
      <p className="mt-1 text-body font-medium text-ink-2">
        {email ? (
          <>
            For <span className="font-semibold text-ink">{email}</span>. You’ll use it with this email to sign in.
          </>
        ) : (
          "You’ll use it with your email to sign in."
        )}
      </p>

      {error ? (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-md bg-red-tint px-3 py-2.5 text-body font-medium text-red-ink">
          <CircleAlert aria-hidden size={18} strokeWidth={1.75} className="mt-px shrink-0" />
          {error}
        </p>
      ) : null}

      <form onSubmit={submit} noValidate className="mt-5 flex flex-col gap-3">
        {/* Lets password managers pair the new password with the right account. */}
        {email ? <input type="email" name="username" autoComplete="username" value={email} readOnly hidden /> : null}
        <Field id="new-password" label="New password" hint={`At least ${MIN_PASSWORD} characters`} error={fieldError}>
          <PasswordInput id="new-password" autoComplete="new-password" value={password} invalid={!!fieldError} hasHint compact onChange={(e) => setPassword(e.target.value)} disabled={pending} />
        </Field>
        <Button type="submit" className="mt-1 w-full" loading={pending}>
          Save password
        </Button>
      </form>

      <div className={AUTH_FOOTER}>
        <p className="flex items-center justify-center gap-1.5 text-center text-badge text-balance text-ink-2">
          <Lock aria-hidden size={14} strokeWidth={1.75} className="shrink-0" />
          Your password is stored encrypted. Funza never sees it.
        </p>
      </div>
    </div>
  );
}
