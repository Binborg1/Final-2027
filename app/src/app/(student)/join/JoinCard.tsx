"use client";

import { ArrowRight, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Logo } from "@/components/ui/Misc";
import { normalizeCode } from "@/lib/live/code";
import { DEVICE_KEY, LAST_KEY, savedSeat, seatKey, type LastSeat } from "@/lib/live/seat";

type Problem = { field: "code" | "name" | "studentNo" | null; text: string };

const FIELD_OF: Record<string, Problem["field"]> = { "bad-code": "code", "no-session": "code", closed: "code", full: "code", "bad-name": "name", "needs-student-no": "studentNo" };

function deviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

/** F5 "Join": the code (filled in from the QR code), a name and, if the teacher asks, a student number. */
export function JoinCard({ initialCode }: { initialCode: string }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState("");
  const [studentNo, setStudentNo] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [rejoin, setRejoin] = useState<LastSeat | null>(null);

  useEffect(() => {
    // A phone that already joined a session can go straight back to it.
    try {
      const last = JSON.parse(localStorage.getItem(LAST_KEY) ?? "null") as LastSeat | null;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from this phone's storage after hydration
      if (last && savedSeat(last.session)) setRejoin(last);
    } catch {}
    if (initialCode.length === 6) document.getElementById("name")?.focus();
  }, [initialCode]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setProblem(null);
    const c = normalizeCode(code);
    if (c.length !== 6) return setProblem({ field: "code", text: "A code has 6 letters and numbers, like K7QM4P." });
    if (!name.trim()) return setProblem({ field: "name", text: "Type your name." });
    setBusy(true);
    try {
      const res = await fetch("/api/live/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: c, name, studentNo, device: deviceId() }) });
      const json = (await res.json().catch(() => null)) as { ok: boolean; reason?: string; message?: string; data?: { session: string; participantId: string; token: string; name: string } } | null;
      if (!json?.ok || !json.data) {
        const field = FIELD_OF[json?.reason ?? ""] ?? null;
        setProblem({ field, text: json?.message ?? "Couldn't join. Check your connection and try again." });
        if (field) document.getElementById(field)?.focus();
        setBusy(false);
        return;
      }
      const { session, participantId, token } = json.data;
      localStorage.setItem(seatKey(session), JSON.stringify({ token, participantId, name: json.data.name }));
      localStorage.setItem(LAST_KEY, JSON.stringify({ session, name: json.data.name } satisfies LastSeat));
      router.push(`/play/${session}`);
    } catch {
      setProblem({ field: null, text: "Couldn't join. Check your connection and try again." });
      setBusy(false);
    }
  }

  return (
    <div className="frost frost-auth h-fit w-full max-w-[440px] rounded-auth border border-white/45 px-8 pt-8 pb-7 shadow-auth max-sm:px-5 max-sm:pt-6">
      <Logo size={32} wordmark />
      <h1 className="mt-6 text-hero font-bold max-sm:text-[28px] max-sm:leading-[34px]">Join a live session</h1>
      <p className="mt-1 text-card-sm font-medium text-ink-2">The code is on your teacher&rsquo;s screen.</p>

      {rejoin ? (
        <a href={`/play/${rejoin.session}`} className="mt-5 flex min-h-[52px] items-center gap-3 rounded-md border border-line-2 bg-raised px-4 text-row font-semibold text-ink hover:bg-white">
          <RotateCcw aria-hidden size={18} strokeWidth={1.75} className="text-accent-ink" />
          Rejoin as {rejoin.name}
        </a>
      ) : null}

      <form onSubmit={submit} noValidate className="mt-5 flex flex-col gap-4 rounded-card bg-surface p-4">
        <Field id="code" label="Code" error={problem?.field === "code" ? problem.text : undefined}>
          <Input
            id="code"
            value={code}
            onChange={(e) => setCode(normalizeCode(e.target.value).slice(0, 6))}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            inputMode="text"
            placeholder="K7QM4P"
            invalid={problem?.field === "code"}
            className="font-semibold tracking-[0.3em] uppercase"
          />
        </Field>
        <Field id="name" label="Name" error={problem?.field === "name" ? problem.text : undefined}>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoComplete="given-name" invalid={problem?.field === "name"} />
        </Field>
        <Field id="studentNo" label="Student number (if your teacher asks)" error={problem?.field === "studentNo" ? problem.text : undefined}>
          <Input id="studentNo" value={studentNo} onChange={(e) => setStudentNo(e.target.value)} maxLength={30} inputMode="numeric" autoComplete="off" invalid={problem?.field === "studentNo"} />
        </Field>
      </form>

      {problem && problem.field === null ? (
        <p role="alert" className="mt-3 text-meta font-medium text-red-ink">
          {problem.text}
        </p>
      ) : null}

      <Button size="lg" type="submit" className="mt-5 w-full" iconRight={ArrowRight} loading={busy} onClick={submit}>
        Join
      </Button>
      <p className="mt-3 text-center text-meta font-medium text-ink-2">No account needed. Your teacher will see your name.</p>
    </div>
  );
}
