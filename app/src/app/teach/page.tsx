"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { BrainMascot } from "@/components/BrainMascot";
import { Button } from "@/components/Button";
import { ClassCard } from "@/components/classes/ClassCard";
import { fieldClass } from "@/components/classes/ui";
import { Item, Rise, Stagger } from "@/components/motion";
import { Spinner } from "@/components/Spinner";
import { classApi, rememberTeaching } from "@/lib/classes/client";
import { useHydrated, useTeaching } from "@/lib/storage";

const steps = [
  { title: "Upload a lecture", text: "Add the PDF of your notes. Funza drafts an explanation, a second explanation, a question, hints and the reason the answer is right for each concept." },
  { title: "Review every concept", text: "Edit anything, approve what is right, remove what is not. Nothing reaches students until you approve it." },
  { title: "Publish to your class", text: "Students join with your class code and practise with hints instead of answers, using only what you approved." },
];

export default function TeachPage() {
  const router = useRouter();
  const hydrated = useHydrated();
  const teaching = useTeaching();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [term, setTerm] = useState("");
  const [professor, setProfessor] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!name.trim() || !professor.trim()) {
      setError("Add the class name and the name students know you by.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await classApi.create({ name, term, professor });
    if (!res.ok) {
      setBusy(false);
      setError(res.message);
      return;
    }
    rememberTeaching(res.data.record.code, res.data.editKey, res.data.record.name);
    router.push(`/teach/${res.data.record.code}`);
  }

  return (
    <div>
      <header className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <BrainMascot mood="happy" size={112} animate className="hidden sm:block" />
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight">Teach with Funza</h1>
            <p className="mt-2 max-w-xl text-smoke">
              Turn a lecture PDF into practice material, check every piece of it, and publish it to your class.
            </p>
          </div>
        </div>
        {!creating && <Button onClick={() => setCreating(true)}>New class</Button>}
      </header>

      {creating && (
        <Rise>
          <form onSubmit={onCreate} className="mt-6 rounded-3xl border border-line bg-white p-6 shadow-card md:p-8">
            <h2 className="text-xl font-extrabold">New class</h2>
            <div className="mt-5 grid gap-5 md:grid-cols-3">
              <label className="block text-sm">
                <span className="font-bold text-charcoal">Class name</span>
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Computer Networks" maxLength={80} className={fieldClass} />
              </label>
              <label className="block text-sm">
                <span className="font-bold text-charcoal">Term</span>
                <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Winter 2027" maxLength={40} className={fieldClass} />
              </label>
              <label className="block text-sm">
                <span className="font-bold text-charcoal">Your name, as students see it</span>
                <input value={professor} onChange={(e) => setProfessor(e.target.value)} placeholder="Dr. Sample" maxLength={80} className={fieldClass} />
              </label>
            </div>
            <p className="mt-4 text-xs text-smoke">
              There are no accounts yet: this browser keeps the key that lets you edit the class. You can copy a private
              edit link afterwards to open it on another computer.
            </p>
            {error && <p className="mt-3 text-sm font-semibold text-coral-dark">{error}</p>}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={busy}>
                {busy && <Spinner />}
                {busy ? "Creating class" : "Create class"}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setCreating(false)} disabled={busy}>
                Cancel
              </Button>
            </div>
          </form>
        </Rise>
      )}

      <section className="mt-10" aria-label="Your classes">
        <h2 className="text-xl font-extrabold">Classes you teach</h2>
        {!hydrated ? null : teaching.length === 0 ? (
          <p className="mt-2 text-sm text-smoke">None yet. Create a class to get its join code.</p>
        ) : (
          <Stagger className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {teaching.map((t, index) => (
              <Item key={t.code}>
                <ClassCard href={`/teach/${t.code}`} name={t.name} detail="You teach this class" code={t.code} index={index} />
              </Item>
            ))}
          </Stagger>
        )}
      </section>

      <section className="mt-12" aria-label="How it works">
        <h2 className="text-xl font-extrabold">How it works</h2>
        <ol className="mt-4 grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="rounded-3xl border border-line bg-white/70 p-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-peach text-sm font-extrabold text-peach-dark shadow-edge">
                {i + 1}
              </span>
              <h3 className="mt-3 font-extrabold">{s.title}</h3>
              <p className="mt-1 text-sm leading-6 text-smoke">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
