"use client";

import { ArrowLeft, ArrowRight, CircleAlert, CircleCheck, GraduationCap, Search } from "lucide-react";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Overline } from "@/components/ui/Card";
import { ChoiceChip, Tag } from "@/components/ui/Chip";
import { Checkbox, Field, Input } from "@/components/ui/Field";
import { Logo, Stepper } from "@/components/ui/Misc";
import { finishSetup, saveCourses, saveProfile } from "@/lib/teachers/actions";
import { gradesLabel } from "@/lib/teachers/labels";
import { courseRows, keyOf, MAX_COURSES, subjectOptions, type CourseChoice, type CurriculumCourse } from "@/lib/teachers/setup";
import { cn } from "@/lib/ui/cn";

type Profile = { name: string; school: string; grades: number[]; subjects: string[] };

const STEPS = [{ label: "Grades and subjects" }, { label: "Your courses" }, { label: "Google Classroom", note: "Optional" }];
const GRADES = [10, 11, 12] as const;

/** A2 First-time setup: three steps, each saved as the teacher moves on, so a half-done setup keeps its answers. */
export function SetupWizard({
  initialStep,
  profile: initialProfile,
  email,
  chosen: initialChosen,
  curriculum,
  classroom,
}: {
  initialStep: number;
  profile: Profile;
  email: string | null;
  chosen: CourseChoice[];
  curriculum: CurriculumCourse[];
  classroom: { configured: boolean; result: string | null };
}) {
  const [step, setStep] = useState(initialStep);
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(initialChosen.map(keyOf)));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const go = (n: number) => {
    setError(null);
    setStep(n);
    window.history.replaceState(null, "", `/setup?step=${n}`);
    window.scrollTo({ top: 0 });
  };

  const continueFromProfile = () =>
    start(async () => {
      const subjects = profile.subjects.filter((s) => subjectOptions(curriculum, profile.grades).includes(s));
      const res = await saveProfile({ ...profile, subjects });
      if (!res.ok) return setError(res.message);
      setProfile((p) => ({ ...p, subjects }));
      go(2);
    });

  const continueFromCourses = () =>
    start(async () => {
      const choices = [...chosen].map((k) => {
        const [curriculumCourseId, level] = k.split(":");
        return { curriculumCourseId, level: Number(level) };
      });
      const res = await saveCourses(choices);
      if (!res.ok) return setError(res.message);
      go(3);
    });

  const finish = () =>
    start(async () => {
      const res = await finishSetup();
      if (res && !res.ok) setError(res.message);
    });

  return (
    <div className="frost frost-auth w-full max-w-[1040px] rounded-auth border border-white/45 px-10 py-12 shadow-auth max-md:px-5 max-md:py-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <Logo />
        <div className="max-sm:hidden">
          <Stepper steps={STEPS} current={step - 1} />
        </div>
      </div>

      {step === 1 ? (
        <ProfileStep profile={profile} setProfile={setProfile} email={email} curriculum={curriculum} />
      ) : step === 2 ? (
        <CoursesStep profile={profile} curriculum={curriculum} chosen={chosen} setChosen={setChosen} />
      ) : (
        <ClassroomStep classroom={classroom} />
      )}

      {error ? (
        <p role="alert" className="mt-4 flex items-start gap-2.5 rounded-md bg-red-tint px-3.5 py-3 text-body font-medium text-red-ink">
          <CircleAlert aria-hidden size={18} className="mt-px shrink-0" />
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-ink/10 pt-5">
        {step > 1 ? (
          <Button variant="secondary" icon={ArrowLeft} onClick={() => go(step - 1)} disabled={pending} className="h-[50px] pr-[22px] pl-[18px]">
            Back
          </Button>
        ) : null}
        <p className="ml-auto text-body font-medium" aria-live="polite">
          {step === 1 ? summaryOfProfile(profile) : step === 2 ? `${chosen.size} course${chosen.size === 1 ? "" : "s"} selected` : null}
        </p>
        {step === 1 ? (
          <Button size="lg" iconRight={ArrowRight} loading={pending} onClick={continueFromProfile} className="pr-6 pl-7">
            Continue
          </Button>
        ) : step === 2 ? (
          <Button size="lg" iconRight={ArrowRight} loading={pending} onClick={continueFromCourses} disabled={chosen.size === 0} className="pr-6 pl-7">
            Continue
          </Button>
        ) : (
          <Button size="lg" iconRight={ArrowRight} loading={pending} onClick={finish} className="pr-6 pl-7">
            Finish setup
          </Button>
        )}
      </div>
    </div>
  );
}

const summaryOfProfile = (p: Profile) => [gradesLabel(p.grades), p.subjects.length > 0 ? `${p.subjects.length} subject${p.subjects.length === 1 ? "" : "s"}` : ""].filter(Boolean).join(" · ");

function StepHeading({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className="mt-[34px] flex flex-col gap-2">
      <Overline>{eyebrow}</Overline>
      <h1 className="text-hero leading-[42px] font-bold max-sm:text-[28px] max-sm:leading-[34px]">{title}</h1>
      {children ? <p className="max-w-2xl text-card-sm font-medium text-ink-2">{children}</p> : null}
    </div>
  );
}

/* ---------- step 1: grades and subjects (not drawn in Figma; built from step 2's parts) ---------- */

function ProfileStep({ profile, setProfile, email, curriculum }: { profile: Profile; setProfile: (fn: (p: Profile) => Profile) => void; email: string | null; curriculum: CurriculumCourse[] }) {
  const subjects = useMemo(() => subjectOptions(curriculum, profile.grades), [curriculum, profile.grades]);
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  return (
    <>
      <StepHeading eyebrow="Step 1 of 3" title="Tell Funza what you teach">
        Funza uses this to show you the right Saskatchewan courses. You can change it later in Settings.
      </StepHeading>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="name" label="Your name" hint={email ? `Signed in as ${email}` : undefined}>
          <Input id="name" autoComplete="name" value={profile.name} hasHint={!!email} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} placeholder="First and last name" />
        </Field>
        <Field id="school" label="School (optional)">
          <Input id="school" autoComplete="organization" value={profile.school} onChange={(e) => setProfile((p) => ({ ...p, school: e.target.value }))} placeholder="Your school" />
        </Field>
      </div>
      <fieldset className="mt-6 flex flex-col gap-3">
        <Overline as="legend">Grades you teach</Overline>
        <div className="mt-3 flex flex-wrap gap-2">
          {GRADES.map((g) => (
            <ChoiceChip key={g} selected={profile.grades.includes(g)} onClick={() => setProfile((p) => ({ ...p, grades: toggle(p.grades, g).sort((a, b) => a - b) }))}>
              Grade {g}
            </ChoiceChip>
          ))}
        </div>
      </fieldset>
      <fieldset className="mt-6 flex flex-col gap-3">
        <Overline as="legend">Subjects</Overline>
        {profile.grades.length === 0 ? (
          <p className="mt-3 text-body text-ink-2">Choose your grades first, and the subjects taught in them appear here.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {subjects.map((s) => (
              <ChoiceChip key={s} selected={profile.subjects.includes(s)} onClick={() => setProfile((p) => ({ ...p, subjects: toggle(p.subjects, s) }))}>
                {s}
              </ChoiceChip>
            ))}
          </div>
        )}
      </fieldset>
    </>
  );
}

/* ---------- step 2: courses (A2) ---------- */

function CoursesStep({ profile, curriculum, chosen, setChosen }: { profile: Profile; curriculum: CurriculumCourse[]; chosen: Set<string>; setChosen: (fn: (s: Set<string>) => Set<string>) => void }) {
  const [query, setQuery] = useState("");
  const [grades, setGrades] = useState<number[]>(profile.grades);
  const rows = useMemo(() => courseRows(curriculum, grades, profile.subjects), [curriculum, grades, profile.subjects]);
  const q = query.trim().toLowerCase();
  const visible = q ? rows.filter((r) => r.title.toLowerCase().includes(q) || r.subject.toLowerCase().includes(q)) : rows;
  const full = chosen.size >= MAX_COURSES;

  return (
    <>
      <StepHeading eyebrow="Step 2 of 3" title="Pick your courses from the Saskatchewan curriculum" />
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <label className="relative min-w-[240px] flex-1">
          <span className="sr-only">Search courses</span>
          <Search aria-hidden size={18} className="absolute top-1/2 left-[18px] -translate-y-1/2 text-ink-2" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search courses, e.g. Physics 30" className="h-12 w-full rounded-3xl border border-line-control bg-field pr-4 pl-11 text-row font-normal placeholder:text-ink-2" />
        </label>
        <div role="group" aria-label="Show grades" className="flex items-center gap-2">
          <Overline as="span" className="mr-1">Grade</Overline>
          {profile.grades.map((g) => (
            <ChoiceChip key={g} selected={grades.includes(g)} onClick={() => setGrades((gs) => (gs.includes(g) ? (gs.length > 1 ? gs.filter((x) => x !== g) : gs) : [...gs, g].sort()))}>
              {g}
            </ChoiceChip>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-card border border-line-glass bg-surface p-2">
        <div className="flex items-center justify-between px-4 pt-2.5 pb-1.5 text-meta font-medium text-ink-2">
          <span>Saskatchewan curriculum · {gradesLabel(grades)}</span>
          <span>
            {visible.length} course{visible.length === 1 ? "" : "s"}
          </span>
        </div>
        {visible.length === 0 ? (
          <p className="px-4 py-6 text-body text-ink-2">No courses match. Try another search, or go back and add a subject.</p>
        ) : (
          <ul className="scrollbar-thin flex max-h-[min(300px,40vh)] flex-col gap-1 overflow-y-auto" aria-label="Courses">
            {visible.map((r) => {
              const on = chosen.has(r.key);
              return (
                <li key={r.key}>
                  <label className={cn("flex min-h-16 cursor-pointer items-center gap-3.5 rounded-tile border px-4 py-2", on ? "border-white bg-white/90" : "border-transparent hover:bg-white/50")}>
                    <Checkbox
                      checked={on}
                      disabled={!on && full}
                      onChange={() =>
                        setChosen((s) => {
                          const n = new Set(s);
                          if (n.has(r.key)) n.delete(r.key);
                          else n.add(r.key);
                          return n;
                        })
                      }
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-card-sm font-semibold">{r.title}</span>
                      <span className="text-meta text-ink-2">{r.units > 0 ? `${r.units} chapter${r.units === 1 ? "" : "s"} from the curriculum units` : `${r.subject} · chapters from its outcomes`}</span>
                    </span>
                    <Tag>Grade {r.grade}</Tag>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <p className="mt-4 text-body text-ink-2">{full ? `That’s the most for now (${MAX_COURSES}). ` : ""}Each course gets chapters from the Ministry units. You can rename or add chapters later.</p>
    </>
  );
}

/* ---------- step 3: Google Classroom (optional; not drawn in Figma) ---------- */

function ClassroomStep({ classroom }: { classroom: { configured: boolean; result: string | null } }) {
  const connected = classroom.result === "connected";
  const message =
    classroom.result === "connected"
      ? null
      : classroom.result === "cancelled"
        ? "Classroom wasn’t connected. You can try again, or skip it for now."
        : classroom.result === "blocked"
          ? "Your school’s Google admin doesn’t allow this yet. You can skip it and print or share materials instead."
          : classroom.result
            ? "Classroom couldn’t be connected just now. You can try again later in Settings."
            : null;
  return (
    <>
      <StepHeading eyebrow="Step 3 of 3 · Optional" title="Connect Google Classroom">
        Funza can post approved materials to your classes as drafts that you release. You can also do this later in Settings, or skip it and print instead.
      </StepHeading>
      <div className="mt-6 flex flex-col items-start gap-4 rounded-card border border-line-glass bg-surface p-6">
        <span className="flex size-11 items-center justify-center rounded-md bg-accent-tint text-accent">
          <GraduationCap aria-hidden size={22} strokeWidth={1.6} />
        </span>
        {connected ? (
          <p role="status" className="flex items-center gap-2 text-row font-semibold text-sage-ink">
            <CircleCheck aria-hidden size={18} /> Google Classroom is connected.
          </p>
        ) : classroom.configured ? (
          <>
            <p className="text-body text-ink-2">You’ll go to Google to choose your account, then come back here.</p>
            <ButtonLink href={`/api/lms/google/connect?returnTo=${encodeURIComponent("/setup?step=3")}`} variant="secondary" icon={GraduationCap}>
              Connect Google Classroom
            </ButtonLink>
          </>
        ) : (
          <p className="text-body text-ink-2">Google Classroom isn’t set up on this Funza server yet, so you can skip this step.</p>
        )}
        {message ? <p className="text-body font-medium text-amber-ink">{message}</p> : null}
      </div>
    </>
  );
}
