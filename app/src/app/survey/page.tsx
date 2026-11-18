"use client";

import { useState, type FormEvent } from "react";
import { BrainMascot } from "@/components/BrainMascot";
import { Button } from "@/components/Button";
import { LIKERT, SURVEY, type SurveyItem } from "@/lib/survey/questionnaire";

type Value = string | string[] | number | Record<string, number>;
type Values = Record<string, Value>;
type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; participant: string } | { kind: "error"; message: string };

const field =
  "w-full rounded-2xl border border-line bg-white px-4 py-2.5 text-sm leading-6 shadow-track outline-none transition-shadow focus:border-coral focus:ring-4 focus:ring-coral/20";

/** The usability questionnaire for phones: the same items as the paper sheet, saved to the server on Send. */
export default function SurveyPage() {
  const [participant, setParticipant] = useState("");
  const [values, setValues] = useState<Values>({});
  const [other, setOther] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const set = (id: string, value: Value) => setValues((prev) => ({ ...prev, [id]: value }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (status.kind === "sending") return;
    setStatus({ kind: "sending" });
    const answers: Values = { ...values };
    for (const [id, text] of Object.entries(other)) {
      const t = text.trim();
      if (!t) continue;
      const current = answers[id];
      if (Array.isArray(current)) answers[id] = [...current, t];
      else if (!current) answers[id] = t;
    }
    try {
      const res = await fetch("/api/survey", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ participant, answers }) });
      const data = (await res.json()) as { ok: boolean; message?: string };
      if (data.ok) {
        setStatus({ kind: "sent", participant });
        window.scrollTo({ top: 0 });
      } else setStatus({ kind: "error", message: data.message ?? "Your answers could not be sent." });
    } catch {
      setStatus({ kind: "error", message: "Could not reach the server. Check the connection and try again, or ask for a paper copy." });
    }
  }

  function reset() {
    setValues({});
    setOther({});
    setParticipant("");
    setStatus({ kind: "idle" });
  }

  if (status.kind === "sent") {
    return (
      <div className="mx-auto max-w-lg py-10 text-center">
        <BrainMascot mood="celebrating" size={112} animate />
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Thank you!</h1>
        <p className="mt-2 text-charcoal/85">
          Your answers are in{status.participant ? ` as participant ${status.participant}` : ""}. Please let the observer know you are done.
        </p>
        <Button variant="secondary" className="mt-6" onClick={reset}>
          Start a new response
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-lg">
      <header className="flex items-center gap-4">
        <BrainMascot mood="happy" size={72} animate />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Funza usability questionnaire</h1>
          <p className="mt-1 text-sm text-smoke">About 8 minutes. Anonymous, used only by our team (Aubin and Chop, ENSE 400). We are testing the app, not you.</p>
        </div>
      </header>

      <label className="mt-6 block text-sm font-bold">
        Participant number <span className="font-semibold text-smoke">(the observer tells you this)</span>
        <input value={participant} onChange={(e) => setParticipant(e.target.value.slice(0, 40))} placeholder="e.g. P2" className={`${field} mt-1 max-w-40`} />
      </label>

      {SURVEY.map((section) => (
        <section key={section.id} className="mt-8 rounded-3xl border border-line bg-white p-5 shadow-card">
          <h2 className="text-lg font-bold">{section.title}</h2>
          {section.intro && <p className="mt-1 text-sm text-smoke">{section.intro}</p>}
          <div className="mt-4 space-y-5">
            {section.items.map((item) => (
              <Item key={item.id} item={item} value={values[item.id]} onChange={(v) => set(item.id, v)} other={other[item.id] ?? ""} onOther={(t) => setOther((prev) => ({ ...prev, [item.id]: t }))} />
            ))}
          </div>
        </section>
      ))}

      {status.kind === "error" && (
        <p role="alert" className="mt-6 rounded-2xl border border-peach bg-peach/60 px-4 py-3 text-sm font-semibold text-peach-dark">
          {status.message}
        </p>
      )}
      <div className="mt-6 flex flex-wrap items-center gap-3 pb-10">
        <Button type="submit" disabled={status.kind === "sending"}>
          {status.kind === "sending" ? "Sending..." : "Send my answers"}
        </Button>
        <span className="text-xs font-semibold text-smoke">You can leave questions blank.</span>
      </div>
    </form>
  );
}

function Item({ item, value, onChange, other, onOther }: { item: SurveyItem; value: Value | undefined; onChange: (v: Value) => void; other: string; onOther: (t: string) => void }) {
  const label = (
    <span className="block text-sm font-bold">
      <span className="mr-1.5 text-smoke">{item.id}.</span>
      {item.label}
    </span>
  );
  switch (item.kind) {
    case "text":
      return (
        <label className="block">
          {label}
          <input value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value.slice(0, 200))} placeholder={item.placeholder} className={`${field} mt-1.5`} />
        </label>
      );
    case "long":
      return (
        <label className="block">
          {label}
          <textarea value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value.slice(0, 2000))} rows={3} className={`${field} mt-1.5 resize-y`} />
        </label>
      );
    case "likert": {
      const chosen = typeof value === "number" ? value : null;
      return (
        <div>
          {label}
          <div className="mt-2 flex items-center gap-2">
            <span className="w-14 text-[10px] leading-3 font-semibold text-smoke">strongly disagree</span>
            <div role="radiogroup" aria-label={item.label} className="flex flex-1 justify-between gap-1.5">
              {LIKERT.map((n) => {
                const num = Number(n);
                const on = chosen === num;
                return (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => onChange(num)}
                    className={`h-11 flex-1 rounded-full border text-sm font-bold transition-colors focus-visible:ring-4 focus-visible:ring-coral/30 focus-visible:outline-none ${
                      on ? "border-coral bg-coral text-white shadow-button" : "border-line bg-white text-charcoal hover:bg-sand"
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            <span className="w-14 text-right text-[10px] leading-3 font-semibold text-smoke">strongly agree</span>
          </div>
        </div>
      );
    }
    case "choice": {
      const selected = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
      const toggle = (option: string) => {
        if (item.multi) onChange(selected.includes(option) ? selected.filter((o) => o !== option) : [...selected, option]);
        else onChange(option);
      };
      return (
        <fieldset>
          <legend>{label}</legend>
          <div className="mt-2 grid gap-2">
            {item.options.map((option) => {
              const on = selected.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  role={item.multi ? "checkbox" : "radio"}
                  aria-checked={on}
                  onClick={() => toggle(option)}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-2.5 text-left text-sm font-semibold transition-colors focus-visible:ring-4 focus-visible:ring-coral/30 focus-visible:outline-none ${
                    on ? "border-coral bg-peach/60" : "border-line bg-white hover:bg-sand"
                  }`}
                >
                  <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center border-2 text-[11px] font-bold ${item.multi ? "rounded-md" : "rounded-full"} ${on ? "border-coral bg-coral text-white" : "border-line bg-white"}`}>
                    {on ? "✓" : ""}
                  </span>
                  {option}
                </button>
              );
            })}
            {item.other && <input value={other} onChange={(e) => onOther(e.target.value.slice(0, 200))} placeholder="Other..." aria-label={`${item.id} other`} className={field} />}
          </div>
        </fieldset>
      );
    }
    case "rank": {
      const ranks = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, number>) : {};
      const used = Object.values(ranks);
      const duplicates = new Set(used.filter((r, i) => used.indexOf(r) !== i));
      return (
        <fieldset>
          <legend className="sr-only">{item.label}</legend>
          <div className="grid gap-2">
            {item.options.map((option, i) => {
              const current = ranks[String(i)];
              return (
                <label key={option} className="flex items-center gap-3 rounded-2xl border border-line bg-white px-3 py-2 text-sm font-semibold">
                  <select
                    value={current ?? ""}
                    onChange={(e) => {
                      const next = { ...ranks };
                      if (e.target.value === "") delete next[String(i)];
                      else next[String(i)] = Number(e.target.value);
                      onChange(next);
                    }}
                    aria-label={`Rank for: ${option}`}
                    className={`w-16 rounded-xl border px-2 py-1.5 text-sm font-bold outline-none focus:border-coral focus:ring-4 focus:ring-coral/20 ${current && duplicates.has(current) ? "border-coral bg-peach/60" : "border-line bg-white"}`}
                  >
                    <option value="">–</option>
                    {item.options.map((_, n) => (
                      <option key={n} value={n + 1}>
                        {n + 1}
                      </option>
                    ))}
                  </select>
                  <span>{option}</span>
                </label>
              );
            })}
          </div>
          {duplicates.size > 0 && <p className="mt-2 text-xs font-semibold text-peach-dark">Two ideas share a number. Use each number once if you can.</p>}
        </fieldset>
      );
    }
  }
}
