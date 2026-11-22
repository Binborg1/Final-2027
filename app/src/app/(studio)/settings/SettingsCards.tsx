"use client";

import { Check, CircleAlert, CircleCheck, GraduationCap, LogOut, PenLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { Avatar } from "@/components/shell/Avatar";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader, Overline } from "@/components/ui/Card";
import { ChoiceChip } from "@/components/ui/Chip";
import { Field, Input } from "@/components/ui/Field";
import type { Teacher } from "@/lib/auth/teacher-model";
import { initials } from "@/lib/auth/teacher-model";
import { connectUrl, lmsDisconnect } from "@/lib/lms/client";
import { refreshLms, useLms } from "@/lib/lms/useLms";
import { saveProfile } from "@/lib/teachers/actions";
import { gradesLabel } from "@/lib/teachers/labels";
import { subjectOptions, type CurriculumCourse } from "@/lib/teachers/setup";

const LMS_RESULT: Record<string, { tone: "ok" | "bad"; text: string }> = {
  connected: { tone: "ok", text: "Google Classroom is connected." },
  cancelled: { tone: "bad", text: "Classroom wasn’t connected. You can try again any time." },
  blocked: { tone: "bad", text: "Your school’s Google admin doesn’t allow this app yet." },
  error: { tone: "bad", text: "Classroom couldn’t be connected just now. Please try again." },
  "not-configured": { tone: "bad", text: "Google Classroom isn’t set up on this Funza server." },
};

export function SettingsCards({ teacher, curriculum, classroomConfigured, lmsResult }: { teacher: Teacher; curriculum: CurriculumCourse[]; classroomConfigured: boolean; lmsResult: string | null }) {
  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <ProfileCard teacher={teacher} curriculum={curriculum} />
      </div>
      <div className="flex flex-col gap-4">
        <ClassroomCard configured={classroomConfigured} result={lmsResult ? LMS_RESULT[lmsResult] ?? LMS_RESULT.error : null} />
        <StudentDataCard />
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[42px] items-center gap-4 border-t border-line py-2 text-body">
      <span className="w-[130px] shrink-0 font-medium text-ink-2">{label}</span>
      <span className="min-w-0 flex-1 truncate font-semibold">{children}</span>
    </div>
  );
}

function ProfileCard({ teacher, curriculum }: { teacher: Teacher; curriculum: CurriculumCourse[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: teacher.name, school: teacher.school, grades: teacher.grades, subjects: teacher.subjects });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const subjects = useMemo(() => subjectOptions(curriculum, form.grades), [curriculum, form.grades]);
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const save = () =>
    start(async () => {
      const res = await saveProfile({ ...form, subjects: form.subjects.filter((s) => subjects.includes(s)) });
      if (!res.ok) return setError(res.message);
      setError(null);
      setEditing(false);
      setSaved(true);
      router.refresh();
    });

  return (
    <Card id="profile" className="flex scroll-mt-6 flex-col gap-3.5 px-6 pt-5 pb-[22px]" aria-labelledby="profile-title">
      <CardHeader
        id="profile-title"
        title="Profile"
        actions={
          !editing ? (
            <Button variant="ghost" size="sm" icon={PenLine} onClick={() => { setEditing(true); setSaved(false); }}>
              Edit
            </Button>
          ) : null
        }
      />
      <div className="flex items-center gap-3.5">
        <Avatar initials={initials(teacher)} size={56} />
        <div className="flex flex-col">
          <p className="text-card font-bold">{teacher.name || teacher.email}</p>
          <p className="text-body text-ink-2">Teacher{teacher.grades.length > 0 ? ` · ${gradesLabel(teacher.grades)}` : ""}</p>
        </div>
      </div>
      {saved ? (
        <p role="status" className="flex items-center gap-2 text-body font-semibold text-sage-ink">
          <CircleCheck aria-hidden size={16} /> Saved.
        </p>
      ) : null}
      {editing ? (
        <div className="flex flex-col gap-4 border-t border-line pt-4">
          <Field id="settings-name" label="Your name">
            <Input id="settings-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field id="settings-school" label="School (optional)">
            <Input id="settings-school" value={form.school} onChange={(e) => setForm((f) => ({ ...f, school: e.target.value }))} />
          </Field>
          <fieldset className="flex flex-col gap-2">
            <Overline as="legend">Grades</Overline>
            <div className="mt-2 flex flex-wrap gap-2">
              {[10, 11, 12].map((g) => (
                <ChoiceChip key={g} selected={form.grades.includes(g)} onClick={() => setForm((f) => ({ ...f, grades: toggle(f.grades, g).sort((a, b) => a - b) }))}>
                  Grade {g}
                </ChoiceChip>
              ))}
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <Overline as="legend">Subjects</Overline>
            <div className="mt-2 flex flex-wrap gap-2">
              {subjects.map((s) => (
                <ChoiceChip key={s} size="md" selected={form.subjects.includes(s)} onClick={() => setForm((f) => ({ ...f, subjects: toggle(f.subjects, s) }))}>
                  {s}
                </ChoiceChip>
              ))}
            </div>
          </fieldset>
          <p className="text-meta text-ink-2">Adding and removing courses arrives with course pages in the next update.</p>
          {error ? (
            <p role="alert" className="flex items-center gap-2 text-body font-medium text-red-ink">
              <CircleAlert aria-hidden size={16} /> {error}
            </p>
          ) : null}
          <div className="flex gap-3">
            <Button icon={Check} loading={pending} onClick={save}>
              Save
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => { setEditing(false); setError(null); setForm({ name: teacher.name, school: teacher.school, grades: teacher.grades, subjects: teacher.subjects }); }}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col">
          <Row label="Email">{teacher.email ?? "None"}</Row>
          <Row label="Signs in with">{teacher.provider === "google" ? "Google" : "Email link"}</Row>
          <Row label="School">{teacher.school || "Not set"}</Row>
          <Row label="Grades">{gradesLabel(teacher.grades) || "Not set"}</Row>
          <Row label="Subjects">{teacher.subjects.join(", ") || "Not set"}</Row>
        </div>
      )}
      <form method="post" action="/auth/sign-out" className="border-t border-line pt-4">
        <Button type="submit" variant="secondary" size="sm" icon={LogOut}>
          Sign out of this browser
        </Button>
      </form>
    </Card>
  );
}

function ClassroomCard({ configured, result }: { configured: boolean; result: { tone: "ok" | "bad"; text: string } | null }) {
  const lms = useLms();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const connected = !!lms?.connected;
  const disconnect = () =>
    start(async () => {
      const res = await lmsDisconnect();
      if (!res.ok) setError(res.message);
      await refreshLms();
    });
  return (
    <Card id="classroom" className="flex scroll-mt-6 flex-col gap-3.5 px-6 pt-5 pb-[22px]" aria-labelledby="classroom-title">
      <CardHeader
        id="classroom-title"
        title="Google Classroom"
        after={
          connected ? (
            <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-sage-tint pr-3 pl-2.5 text-meta font-semibold text-sage-ink">
              <CircleCheck aria-hidden size={14} /> Connected
            </span>
          ) : null
        }
      />
      <p className="text-body text-ink-2">Funza posts approved materials to the class you choose, as drafts you release. Only you can use this connection, and signing out of Funza ends it in this browser.</p>
      {result ? (
        <p role={result.tone === "bad" ? "alert" : "status"} className={result.tone === "ok" ? "text-body font-semibold text-sage-ink" : "text-body font-medium text-amber-ink"}>
          {result.text}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-body font-medium text-red-ink">
          {error}
        </p>
      ) : null}
      {!configured ? (
        <p className="text-body font-medium">Google Classroom isn’t set up on this Funza server yet.</p>
      ) : lms === null ? (
        <p className="text-body text-ink-2">Checking the connection…</p>
      ) : connected ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <p className="flex-1 text-body text-ink-2">Choosing a class for each course arrives with course pages.</p>
          <Button variant="secondary" size="sm" loading={pending} onClick={disconnect}>
            Disconnect
          </Button>
        </div>
      ) : (
        <div>
          <ButtonLink href={connectUrl("/settings")} variant="secondary" icon={GraduationCap}>
            Connect Google Classroom
          </ButtonLink>
        </div>
      )}
    </Card>
  );
}

function StudentDataCard() {
  const facts = ["Stored in Canada", "Names and answers are deleted 30 days after each session", "Student names are never sent to Funza’s AI"];
  return (
    <Card id="student-data" className="flex scroll-mt-6 flex-col gap-3.5 px-6 pt-5 pb-[22px]" aria-labelledby="student-data-title">
      <CardHeader id="student-data-title" title="Student data" />
      <ul className="flex flex-col gap-3">
        {facts.map((f) => (
          <li key={f} className="flex items-center gap-3 text-row font-medium">
            <span aria-hidden className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-sage-tint text-sage-ink">
              <Check size={15} strokeWidth={2.2} />
            </span>
            {f}
          </li>
        ))}
      </ul>
    </Card>
  );
}
