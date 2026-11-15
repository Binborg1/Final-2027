"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/Button";
import { CODE_LENGTH, isValidCode, normalizeCode } from "@/lib/classes/model";

/** A student types the code their professor shared and lands on the class. */
export function JoinClassForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const normalized = normalizeCode(code);
    if (!isValidCode(normalized)) {
      setError(`A class code has ${CODE_LENGTH} letters and numbers, like K7Q2PX.`);
      return;
    }
    router.push(`/class/${normalized}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <label className="block min-w-0 flex-1 text-sm sm:max-w-xs">
        <span className="font-bold text-charcoal">Class code</span>
        <input
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase().slice(0, 12));
            setError(null);
          }}
          placeholder="K7Q2PX"
          autoComplete="off"
          spellCheck={false}
          aria-describedby={error ? "join-error" : undefined}
          className="mt-1.5 w-full rounded-2xl border border-line bg-white px-4 py-2.5 text-sm font-bold tracking-widest shadow-[inset_0_1px_2px_rgba(90,60,30,0.06)] outline-none transition-shadow focus:border-coral focus:ring-4 focus:ring-coral/20"
        />
      </label>
      <Button type="submit">Join class</Button>
      {error && (
        <p id="join-error" className="w-full text-sm font-semibold text-coral-dark">
          {error}
        </p>
      )}
    </form>
  );
}
