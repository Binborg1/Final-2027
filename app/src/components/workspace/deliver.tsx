"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { codeOf } from "@/lib/curriculum/sources";
import { connectUrl, lmsClasses, lmsCreateDoc, lmsPost, lmsTopics, type LmsClass } from "@/lib/lms/client";
import { refreshLms, useLms } from "@/lib/lms/useLms";
import { allItems, numbering, totalMarks } from "@/lib/resources/checks";
import { isQuestionKind, kindInfo } from "@/lib/resources/kinds";
import { postDescription } from "@/lib/resources/render";
import { formatWhen, recordDelivery, setSchoolName, toast, useWorkspace } from "@/lib/resources/store";
import type { Draft, Resource, Section } from "@/lib/resources/types";
import { AlertIcon, ArrowLeft, CheckIcon, CopyIcon, ExternalIcon, LibraryIcon, LockIcon, PlugIcon, PrintIcon, RefreshIcon, XIcon } from "./icons";
import { summarize } from "./parts";
import { ItemView } from "./review";
import { Crumbs, Loading, TopBar } from "./shell";
import { Button, Card, cx, Dialog, EmptyState, Eyebrow, inputClass, Layer, Notice, Pill, Segmented, Skeleton, Spinner, Tabs } from "./ui";

type PostAs = "material" | "assignment" | "quiz";
type When = "draft" | "now" | "schedule";
type Row = { classId: string; name: string; link: string | null; state: "waiting" | "posting" | "done" | "failed"; message: string; itemLink: string | null };

export function DeliverScreen({ id }: { id: string }) {
  const ws = useWorkspace();
  if (!ws.hydrated) return <Loading />;
  const d = ws.drafts[id];
  const r = ws.resources.find((x) => x.id === id);
  if (!d || !r) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <EmptyState
          icon={<LibraryIcon className="h-5 w-5" />}
          title="This resource is not in this browser"
          action={
            <Link href="/library" className="inline-flex h-9 items-center rounded-(--r-md) border border-(--line) bg-(--surface) px-3.5 text-sm font-semibold shadow-(--sh-1) hover:bg-(--surface-2)">
              Open the library
            </Link>
          }
        >
          Approved resources are published from the library they were made in.
        </EmptyState>
      </div>
    );
  }
  return <Deliver d={d} r={r} />;
}

function Deliver({ d, r }: { d: Draft; r: Resource }) {
  const ws = useWorkspace();
  const router = useRouter();
  const [paper, setPaper] = useState<"letter" | "A4">("letter");
  const [printMode, setPrintMode] = useState<"student" | "key">("student");
  const [preview, setPreview] = useState<"student" | "key" | "lms">("student");
  const approved = d.approved;
  const q = isQuestionKind(d.kind);
  const hasKey = allItems(d).length > 0;
  const forStudents = kindInfo(d.kind).forStudents;
  const sections = approved?.sections ?? d.sections;
  const title = approved?.title ?? d.title;

  function print(mode: "student" | "key") {
    setPrintMode(mode);
    recordDelivery(r.id, {
      version: approved?.version ?? d.version,
      what: mode === "key" ? "Answer key" : d.kind === "lesson-plan" ? "Lesson plan" : "Student copy",
      where: approved ? "Printed or saved as PDF" : "Printed as a DRAFT proof",
      state: "done",
      detail: "Opened the print dialog. Choose “Save as PDF” there to keep a file.",
    });
    setTimeout(() => window.print(), 60);
  }

  return (
    <>
      <TopBar
        actions={
          <Button size="sm" variant="ghost" onClick={() => router.push(`/resources/${r.id}`)}>
            <ArrowLeft className="h-4 w-4" /> Back to the document
          </Button>
        }
      >
        <Crumbs items={[{ label: "Library", href: "/library" }, { label: r.title, href: `/resources/${r.id}` }, { label: "Publish" }]} />
      </TopBar>

      {!approved ? (
        <NotApproved d={d} r={r} onProof={() => print("student")} />
      ) : (
        <div className="mx-auto grid max-w-[1240px] items-start gap-6 px-4 py-7 md:px-6 lg:grid-cols-[minmax(0,1fr)_440px] lg:px-8">
          <div className="min-w-0 space-y-5">
            <header>
              <Eyebrow>
                Publish · version {approved.version}, approved {formatWhen(approved.at)}
              </Eyebrow>
              <h1 className="mt-1 text-[26px] leading-tight font-bold">{title}</h1>
              <p className="mt-1 text-[14px] text-(--ink-2)">Everything you publish goes to your school&apos;s platform. Students get only this approved version, never the answer key.</p>
              {d.status === "draft" && (
                <div className="mt-3">
                  <Notice tone="info">You are editing version {d.version}. This page publishes the approved version {approved.version}; approve version {d.version} to publish your changes.</Notice>
                </div>
              )}
            </header>

            {forStudents ? (
              <ClassroomCard d={d} r={r} sections={sections} title={title} version={approved.version} />
            ) : (
              <Card className="p-5">
                <h2 className="text-[16px] font-bold">Lesson plans stay with you</h2>
                <p className="mt-1 text-[13.5px] text-(--ink-2)">A lesson plan is for the teacher, so Funza never posts it to students. Print it or save it as a PDF below.</p>
              </Card>
            )}

            <Card aria-labelledby="dl-h" className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="dl-h" className="text-[16px] font-bold">
                  Print for your own use
                </h2>
                <span className="text-[12.5px] text-(--muted)">Paper copies, your files, your answer key</span>
              </div>
              <ul className="mt-3 divide-y divide-(--line) rounded-(--r-md) border border-(--line)">
                <ExportRow
                  icon={<PrintIcon className="h-[18px] w-[18px]" />}
                  title={d.kind === "lesson-plan" ? "Lesson plan" : q ? "Student copy" : "The document"}
                  sub={q ? "Name and date lines and answer spaces. No answers." : "Exactly the approved text."}
                  action={
                    <Button size="sm" onClick={() => print("student")}>
                      <PrintIcon /> Print or save PDF
                    </Button>
                  }
                />
                {hasKey && (
                  <ExportRow
                    icon={<LockIcon className="h-[18px] w-[18px]" />}
                    title="Answer key"
                    sub={q ? "Answers, worked solutions and rubrics. For you only." : "Answers to the check questions."}
                    action={
                      <Button size="sm" onClick={() => print("key")}>
                        <PrintIcon /> Print or save PDF
                      </Button>
                    }
                  />
                )}
              </ul>
              <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-3">
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="font-semibold">Paper</span>
                  <Segmented size="sm" label="Paper size" value={paper} onChange={setPaper} options={[{ value: "letter", label: "Letter" }, { value: "A4", label: "A4" }]} />
                </div>
                <label className="min-w-[240px] flex-1 text-[13px]">
                  <span className="font-semibold">School name in the header</span>
                  <input value={ws.settings.schoolName} onChange={(e) => setSchoolName(e.target.value)} placeholder="Optional" maxLength={120} className={cx(inputClass, "mt-1 h-9 py-1")} />
                </label>
              </div>
            </Card>

            <History r={r} />
          </div>

          <aside aria-label="Preview" className="lg:sticky lg:top-[72px]">
            <Card className="overflow-hidden">
              <Tabs
                label="Preview"
                value={preview}
                onChange={setPreview}
                tabs={[
                  { value: "student", label: forStudents ? "What students get" : "The plan" },
                  ...(hasKey ? [{ value: "key" as const, label: "Answer key" }] : []),
                  ...(forStudents ? [{ value: "lms" as const, label: "In Classroom" }] : []),
                ]}
              />
              <div className="fz-scroll max-h-[calc(100vh-170px)] overflow-y-auto bg-(--bg-sunk) p-4">
                {preview === "lms" ? (
                  <LmsPreview title={title} kind={d.kind} version={approved.version} />
                ) : (
                  <div className="fz-paper px-6 py-7 text-[13px]">
                    <PrintableDoc d={d} sections={sections} title={title} mode={preview} small />
                  </div>
                )}
              </div>
            </Card>
          </aside>
        </div>
      )}

      <Layer>
        <div className="fz-print-root">
          <style>{`@page { size: ${paper}; margin: 16mm 15mm; }`}</style>
          <PrintableDoc d={d} sections={sections} title={title} mode={printMode} watermark={!approved} />
        </div>
      </Layer>
    </>
  );
}

function NotApproved({ d, r, onProof }: { d: Draft; r: Resource; onProof: () => void }) {
  const sum = summarize(d);
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Card className="p-6">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-(--gold-50) text-(--gold-700)">
          <LockIcon className="h-5 w-5" />
        </span>
        <h1 className="mt-3 text-[22px] font-bold">Approve it before it goes to students</h1>
        <p className="mt-1.5 text-[14px] text-(--ink-2)">
          “{r.title}” is still a draft: {sum.reviewed} of {sum.total} parts reviewed
          {sum.counts.failed > 0 ? `, ${sum.counts.failed} check failed` : ""}. Funza publishes only approved versions, so students never receive unreviewed AI text.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href={`/resources/${r.id}`} className="inline-flex h-9 items-center rounded-(--r-md) bg-(--teal-700) px-3.5 text-sm font-semibold text-white shadow-(--sh-teal) hover:bg-(--teal-800)">
            Back to review
          </Link>
          <Button onClick={onProof}>
            <PrintIcon /> Print a proof marked DRAFT
          </Button>
        </div>
      </Card>
    </div>
  );
}

function ExportRow({ icon, title, sub, action }: { icon: ReactNode; title: string; sub: string; action: ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-3.5 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] bg-(--bg-sunk) text-(--ink-2)">{icon}</span>
      <div className="min-w-0 flex-[1_1_12rem]">
        <p className="text-[14px] font-semibold">{title}</p>
        <p className="text-[12.5px] text-(--muted)">{sub}</p>
      </div>
      {action}
    </li>
  );
}

function History({ r }: { r: Resource }) {
  return (
    <Card aria-labelledby="hist-h" className="p-5">
      <h2 id="hist-h" className="text-[16px] font-bold">
        Publishing history
      </h2>
      {r.deliveries.length === 0 ? (
        <p className="mt-2 text-[13px] text-(--muted)">Nothing yet. Every post and print is recorded here.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {r.deliveries.map((x) => (
            <li key={x.id} className="flex items-start gap-3 text-[13px]">
              <span className={cx("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full", x.state === "failed" ? "bg-(--bad-bg) text-(--bad)" : "bg-(--ok-bg) text-(--ok)")} aria-hidden="true">
                {x.state === "failed" ? <XIcon className="h-3 w-3" /> : <CheckIcon className="h-3 w-3" />}
              </span>
              <div className="min-w-0 flex-1">
                <p>
                  <b>{x.what}</b> (v{x.version}) · {x.where}
                  {x.state === "failed" && (
                    <Pill tone="bad" className="ml-2">
                      Failed
                    </Pill>
                  )}
                </p>
                {x.detail && <p className="text-(--muted)">{x.detail}</p>}
                {x.link && (
                  <a href={x.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-(--teal-700) hover:underline">
                    Open <ExternalIcon className="h-3 w-3" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                )}
              </div>
              <span className="shrink-0 text-[12px] text-(--muted)">{formatWhen(x.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ---------- the document as printed ---------- */

function PrintableDoc({ d, sections, title, mode, watermark = false, small = false }: { d: Draft; sections: Section[]; title: string; mode: "student" | "key"; watermark?: boolean; small?: boolean }) {
  const { settings } = useWorkspace();
  const num = numbering(sections);
  const q = isQuestionKind(d.kind);
  const qParts = sections.filter((s) => s.kind === "questions");
  return (
    <div className={cx("relative text-(--ink)", small ? "text-[13px]" : "text-[11pt]")}>
      {watermark && <p className="mb-3 border-2 border-(--bad) px-2 py-1 text-center text-[12px] font-bold tracking-[0.2em] text-(--bad) uppercase">Draft · not approved · not for students</p>}
      <div className="flex justify-between text-[11px] font-semibold tracking-wide text-(--muted) uppercase">
        <span>
          {d.courseName} · {d.outcomeIds.map(codeOf).join(", ")}
          {mode === "key" && " · answer key · teacher only"}
        </span>
        {settings.schoolName && <span>{settings.schoolName}</span>}
      </div>
      <h2 className={cx("mt-1 font-bold", small ? "text-[18px]" : "text-[18pt]")}>{title}</h2>
      {q && mode === "student" && (
        <div className="mt-3 grid grid-cols-3 gap-3 text-[12px]">
          {["Name", "Date", "Class"].map((f) => (
            <p key={f} className="flex items-end gap-2">
              {f}
              <span className="h-px flex-1 translate-y-[-3px] bg-(--ink)/40" />
            </p>
          ))}
        </div>
      )}
      {q && (
        <p className="mt-2 text-[12px] text-(--ink-2)">
          Total: {totalMarks({ sections })} marks{d.duration ? ` · ${d.duration} minutes` : ""}
        </p>
      )}
      <div className="mt-4 space-y-5">
        {sections.map((sec) =>
          sec.kind === "questions" ? (
            <section key={sec.id} className="fz-keep">
              <p className="border-b border-(--ink) pb-1 font-bold">
                {q ? `Part ${String.fromCharCode(65 + qParts.indexOf(sec))} · ` : ""}
                {sec.title}
              </p>
              {sec.body && <p className="mt-1 text-[12px] text-(--ink-2) italic">{sec.body}</p>}
              <div className="mt-2 space-y-3">
                {sec.items.map((it) => (
                  <div key={it.id} className="fz-keep">
                    <ItemView item={it} n={num.get(it.id) ?? 0} lens={mode} />
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section key={sec.id} className="fz-keep">
              <p className="font-bold">
                {sec.title}
                {sec.minutes !== null && <span className="ml-2 font-normal text-(--muted)">{sec.minutes} min</span>}
              </p>
              {sec.kind === "activity" && <p className="mt-1 text-[12px] text-(--info)">Interactive graph: shown in class from Funza.</p>}
              <div className="mt-1 space-y-1">
                {sec.body.split("\n").map((line, i) =>
                  line.startsWith("- ") ? (
                    <p key={i} className="pl-4 -indent-3">
                      • {line.slice(2)}
                    </p>
                  ) : (
                    <p key={i}>{line}</p>
                  ),
                )}
              </div>
            </section>
          ),
        )}
      </div>
    </div>
  );
}

/* ---------- Google Classroom ---------- */

const ADMIN_NOTE = `Hello,

I would like to use Funza to post teaching resources I create and approve to my Google Classroom classes. Could you allow the Funza app in our Google Workspace for Education admin console?

It asks to see the names and topics of the classes I teach, to create posts and materials I approve, and to create files in my Drive that only it can open. It does not read rosters, grades or student work.

Thank you`;

function ClassroomCard({ d, r, sections, title, version }: { d: Draft; r: Resource; sections: Section[]; title: string; version: number }) {
  const lms = useLms();
  const params = useSearchParams();
  const result = params.get("lms");
  return (
    <Card aria-labelledby="lms-h" className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="lms-h" className="flex items-center gap-2 text-[16px] font-bold">
          <PlugIcon className="h-4 w-4 text-(--muted)" /> Post to Google Classroom
        </h2>
        <span className="flex flex-wrap gap-1.5 text-[11.5px] text-(--muted)">
          {["Microsoft Teams", "Canvas", "Moodle"].map((p) => (
            <Pill key={p} tone="none">
              {p}: planned
            </Pill>
          ))}
        </span>
      </div>
      <div className="mt-4">
        {result === "blocked" && <PermissionRequired />}
        {result === "cancelled" && <Notice tone="info">You cancelled at Google, so nothing was connected.</Notice>}
        {result === "error" && <Notice tone="bad" title="Google did not connect">Something went wrong while signing in. Try again; if it keeps failing, your school may need to allow Funza.</Notice>}
        <div className={result && result !== "connected" ? "mt-3" : ""}>
          {lms === null ? (
            <Skeleton className="h-16 w-full" />
          ) : !lms.configured ? (
            <Notice tone="none" title="Google Classroom is not set up on this Funza server">
              Whoever runs this Funza server adds a Google Cloud OAuth client (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) and a session secret (FUNZA_SESSION_SECRET). The steps are in docs/09_teacher_workspace_design/07_lms_publishing_ux.md. Until then you can print copies below.
            </Notice>
          ) : !lms.connected ? (
            <NotConnected returnTo={`/resources/${r.id}/deliver`} />
          ) : (
            <Connected d={d} r={r} sections={sections} title={title} version={version} />
          )}
        </div>
      </div>
    </Card>
  );
}

function NotConnected({ returnTo }: { returnTo: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-(--r-md) border border-(--line) bg-(--surface-2) p-4">
      <p className="text-[14px] font-semibold">Connect your Google Classroom</p>
      <p className="mt-1 text-[13px] text-(--ink-2)">Sign in with your school Google account once. Funza then posts approved resources to the classes you choose, as drafts you release in Classroom.</p>
      <Button className="mt-3" variant="primary" onClick={() => setOpen(true)}>
        Connect Google Classroom
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="What Funza will ask Google for"
        description="Google's own consent screen comes next. You can disconnect at any time."
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <a href={connectUrl(returnTo)} className="inline-flex h-9 items-center gap-2 rounded-(--r-md) bg-(--teal-700) px-3.5 text-sm font-semibold text-white shadow-(--sh-teal) hover:bg-(--teal-800)">
              Continue to Google <ExternalIcon className="h-4 w-4" />
            </a>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[13px] font-semibold text-(--ok)">Funza will</p>
            <ul className="mt-1.5 space-y-1.5 text-[13px] text-(--ink-2)">
              <li>· See the names of the classes you teach</li>
              <li>· See your class topics</li>
              <li>· Create posts and materials you approve</li>
              <li>· Create documents in your Drive that only it can open</li>
            </ul>
          </div>
          <div>
            <p className="text-[13px] font-semibold text-(--bad)">Funza will not</p>
            <ul className="mt-1.5 space-y-1.5 text-[13px] text-(--ink-2)">
              <li>· Read your rosters or student names</li>
              <li>· Read or change grades or student work</li>
              <li>· Open any other file in your Drive</li>
              <li>· Post anything without your confirmation</li>
            </ul>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

function PermissionRequired() {
  return (
    <Notice
      tone="gold"
      title="Your school has not allowed Funza yet"
      action={
        <Button
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(ADMIN_NOTE);
              toast("Note copied. Paste it into an email to your school's tech lead.");
            } catch {
              toast("Copy did not work in this browser. Open “Show the note” and select the text.", "bad");
            }
          }}
        >
          <CopyIcon /> Copy a note for your admin
        </Button>
      }
    >
      Google said your Workspace admin must approve Funza before teachers can connect it. You can print copies below in the meantime.
      <details className="mt-2">
        <summary className="cursor-pointer font-semibold">Show the note</summary>
        <pre className="mt-2 rounded-(--r-sm) bg-white p-2.5 font-sans text-[12.5px] whitespace-pre-wrap">{ADMIN_NOTE}</pre>
      </details>
    </Notice>
  );
}

function Connected({ d, r, sections, title, version }: { d: Draft; r: Resource; sections: Section[]; title: string; version: number }) {
  const ws = useWorkspace();
  const q = isQuestionKind(d.kind);
  const [classes, setClasses] = useState<LmsClass[] | null>(null);
  const [loadError, setLoadError] = useState<{ reason: string; message: string } | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [postAs, setPostAs] = useState<PostAs>(q ? "assignment" : "material");
  const [topics, setTopics] = useState<{ id: string; name: string }[]>([]);
  const [topic, setTopic] = useState("");
  const [when, setWhen] = useState<When>("draft");
  const [at, setAt] = useState("");
  const [instructions, setInstructions] = useState(postDescription(d.kind, title, ""));
  const [confirm, setConfirm] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const running = rows?.some((x) => x.state === "waiting" || x.state === "posting") ?? false;
  const unsupported = postAs === "quiz";

  useEffect(() => {
    let live = true;
    lmsClasses().then((res) => {
      if (!live) return;
      if (res.ok) setClasses(res.data);
      else {
        setLoadError({ reason: res.reason, message: res.message });
        if (res.reason === "expired" || res.reason === "not-connected") void refreshLms();
      }
    });
    return () => {
      live = false;
    };
  }, []);

  const single = picked.length === 1 ? picked[0] : null;
  useEffect(() => {
    if (!single) return;
    let live = true;
    lmsTopics(single).then((res) => live && setTopics(res.ok ? res.data : []));
    return () => {
      live = false;
    };
  }, [single]);

  async function postTo(targets: { id: string; name: string; link: string | null }[], file: string | null) {
    setRows((prev) => {
      const keep = (prev ?? []).filter((x) => !targets.some((t) => t.id === x.classId));
      return [...keep, ...targets.map((t) => ({ classId: t.id, name: t.name, link: t.link, state: "waiting" as const, message: "Waiting", itemLink: null }))];
    });
    const patch = (cid: string, p: Partial<Row>) => setRows((prev) => (prev ?? []).map((x) => (x.classId === cid ? { ...x, ...p } : x)));
    let docId = file;
    if (!docId) {
      targets.forEach((t) => patch(t.id, { state: "posting", message: "Creating the student copy as a Google Doc in your Drive" }));
      const doc = await lmsCreateDoc({ kind: d.kind, title, version, courseName: d.courseName, outcomeCodes: d.outcomeIds.map(codeOf), duration: d.duration, school: ws.settings.schoolName, sections });
      if (!doc.ok) {
        targets.forEach((t) => {
          patch(t.id, { state: "failed", message: `The document could not be created: ${doc.message}` });
          recordDelivery(r.id, { version, what: "Student copy", where: `Google Classroom · ${t.name}`, state: "failed", detail: doc.message });
        });
        if (doc.reason === "expired") void refreshLms();
        return;
      }
      docId = doc.data.id;
      setFileId(docId);
    }
    for (const t of targets) {
      patch(t.id, { state: "posting", message: when === "draft" ? "Creating a draft post" : "Creating the post" });
      const res = await lmsPost({
        courseId: t.id,
        fileId: docId,
        kind: postAs === "assignment" ? "assignment" : "material",
        title,
        description: postDescription(d.kind, title, instructions),
        state: when === "now" ? "PUBLISHED" : "DRAFT",
        topicId: single && topic ? topic : undefined,
        scheduledTime: when === "schedule" && at ? new Date(at).toISOString() : undefined,
      });
      if (res.ok) {
        const msg = res.data.state === "DRAFT" ? (when === "schedule" ? "Classroom confirmed the post is scheduled" : "Classroom confirmed the draft. Students see it only after you post it there.") : "Classroom confirmed the post. Students can see it now.";
        patch(t.id, { state: "done", message: msg, itemLink: res.data.link ?? t.link });
        recordDelivery(r.id, { version, what: postAs === "assignment" ? "Assignment" : "Material", where: `Google Classroom · ${t.name}`, state: "done", detail: msg, link: res.data.link ?? t.link ?? undefined });
      } else {
        patch(t.id, { state: "failed", message: `Classroom refused the request: ${res.message}` });
        recordDelivery(r.id, { version, what: postAs === "assignment" ? "Assignment" : "Material", where: `Google Classroom · ${t.name}`, state: "failed", detail: res.message });
        if (res.reason === "expired") {
          void refreshLms();
          break;
        }
      }
    }
  }

  if (loadError) {
    return loadError.reason === "permission" ? (
      <PermissionRequired />
    ) : (
      <Notice tone="bad" title="Your classes could not be loaded" action={<Button size="sm" onClick={() => window.location.reload()}><RefreshIcon /> Try again</Button>}>
        {loadError.message}
      </Notice>
    );
  }
  if (!classes) return <Skeleton className="h-24 w-full" />;
  if (classes.length === 0) return <Notice tone="none">Google Classroom shows no active classes where you are a teacher.</Notice>;

  if (rows) {
    const done = rows.filter((x) => x.state === "done").length;
    const failed = rows.filter((x) => x.state === "failed").length;
    return (
      <div className="space-y-3" aria-live="polite">
        <p className="text-[14px] font-semibold">{running ? "Posting to Google Classroom…" : failed === 0 ? `Classroom confirmed ${done} of ${rows.length}` : done === 0 ? "Nothing was posted" : `Posted to ${done} of ${rows.length}; ${failed} failed`}</p>
        <ul className="divide-y divide-(--line) rounded-(--r-md) border border-(--line)">
          {rows.map((row) => (
            <li key={row.classId} className="flex flex-wrap items-start gap-3 px-3 py-2.5 text-[13px]">
              <span
                className={cx("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full", row.state === "done" ? "bg-(--ok-bg) text-(--ok)" : row.state === "failed" ? "bg-(--bad-bg) text-(--bad)" : "text-(--teal-700)")}
                aria-hidden="true"
              >
                {row.state === "done" ? <CheckIcon className="h-3 w-3" /> : row.state === "failed" ? <XIcon className="h-3 w-3" /> : row.state === "waiting" ? <span className="h-1.5 w-1.5 rounded-full bg-(--line-strong)" /> : <Spinner className="h-3.5 w-3.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{row.name}</p>
                <p className={row.state === "failed" ? "text-(--bad)" : "text-(--muted)"}>{row.message}</p>
              </div>
              {row.state === "done" && row.itemLink && (
                <a href={row.itemLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-(--teal-700) hover:underline">
                  Open in Classroom <ExternalIcon className="h-3.5 w-3.5" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              )}
              {row.state === "failed" && !running && (
                <Button size="sm" onClick={() => void postTo([{ id: row.classId, name: row.name, link: row.link }], fileId)}>
                  <RefreshIcon /> Retry
                </Button>
              )}
            </li>
          ))}
        </ul>
        {!running && (
          <Button
            size="sm"
            onClick={() => {
              setRows(null);
              setFileId(null);
              setPicked([]);
            }}
          >
            Post to other classes
          </Button>
        )}
        <p className="text-[12px] text-(--muted)">A post counts as published only when Classroom confirms it.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="text-[13px] font-semibold">Classes</legend>
        <div className="mt-1.5 space-y-1.5">
          {classes.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-2.5 rounded-(--r-md) border border-(--line) px-3 py-2 text-[13.5px] hover:border-(--line-strong)">
              <input type="checkbox" checked={picked.includes(c.id)} onChange={() => setPicked((x) => (x.includes(c.id) ? x.filter((y) => y !== c.id) : [...x, c.id]))} className="h-4 w-4 accent-[#0f766e]" />
              <span className="font-semibold">{c.name}</span>
              {c.section && <span className="text-[12px] text-(--muted)">{c.section}</span>}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <div>
          <p className="text-[13px] font-semibold">Post as</p>
          <div className="mt-1.5">
            <Segmented
              size="sm"
              label="Post as"
              value={postAs}
              onChange={setPostAs}
              options={[
                { value: "material", label: "Material" },
                { value: "assignment", label: "Assignment" },
                { value: "quiz", label: "Auto-graded quiz" },
              ]}
            />
          </div>
        </div>
        {single && topics.length > 0 && (
          <div>
            <label htmlFor="fz-topic" className="text-[13px] font-semibold">
              Topic
            </label>
            <select id="fz-topic" value={topic} onChange={(e) => setTopic(e.target.value)} className={cx(inputClass, "mt-1.5 h-9 w-auto py-1")}>
              <option value="">No topic</option>
              {topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {unsupported && (
        <Notice tone="bad" title="Classroom can't take this as an auto-graded quiz" icon={<AlertIcon className="h-4 w-4" />}>
          Auto-graded quizzes in Classroom are Google Forms, which Funza cannot create. Post it as an assignment with the document attached, or as a material.
        </Notice>
      )}

      <div>
        <label htmlFor="fz-inst" className="text-[13px] font-semibold">
          Instructions students see
        </label>
        <textarea id="fz-inst" rows={2} maxLength={2000} value={instructions} onChange={(e) => setInstructions(e.target.value)} className={cx(inputClass, "mt-1.5 resize-y")} />
      </div>

      <div>
        <p className="text-[13px] font-semibold">Attached</p>
        <ul className="mt-1.5 space-y-1.5 text-[13px]">
          <li className="flex items-center gap-2">
            <CheckIcon className="h-4 w-4 text-(--ok)" /> “{title}” as a Google Doc students can view (version {version})
          </li>
          <li className="flex items-center gap-2 text-(--muted)">
            <LockIcon className="h-4 w-4" /> Answer key: never attached to student posts
          </li>
        </ul>
      </div>

      <div>
        <p className="text-[13px] font-semibold">When</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          <Segmented
            size="sm"
            label="When"
            value={when}
            onChange={setWhen}
            options={[
              { value: "draft", label: "Save as a draft in Classroom" },
              { value: "now", label: "Post now" },
              { value: "schedule", label: "Schedule" },
            ]}
          />
          {when === "schedule" && <input type="datetime-local" aria-label="Post at" value={at} onChange={(e) => setAt(e.target.value)} className={cx(inputClass, "h-9 w-auto py-1")} />}
        </div>
        <p className="mt-1.5 text-[12px] text-(--muted)">{when === "draft" ? "Recommended: students see nothing until you post it from Classroom." : when === "now" ? "Students see it as soon as Classroom confirms." : "Classroom posts it at the time you choose."}</p>
      </div>

      <Button variant="primary" disabled={picked.length === 0 || unsupported || (when === "schedule" && !at)} onClick={() => setConfirm(true)}>
        Review and {when === "draft" ? "create drafts" : when === "now" ? "post" : "schedule"}
      </Button>

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={when === "draft" ? `Create a draft in ${picked.length} class${picked.length === 1 ? "" : "es"}?` : `Post to ${picked.length} class${picked.length === 1 ? "" : "es"}?`}
        description={when === "draft" ? "Students will not see anything until you post the drafts from Classroom." : when === "now" ? "Students will see this as soon as Classroom confirms each post." : "Classroom will post it at the time you chose."}
        footer={
          <>
            <Button onClick={() => setConfirm(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                setConfirm(false);
                void postTo(
                  picked.map((pid) => {
                    const c = classes.find((x) => x.id === pid)!;
                    return { id: c.id, name: c.section ? `${c.name} · ${c.section}` : c.name, link: c.link };
                  }),
                  null,
                );
              }}
            >
              {when === "draft" ? "Create drafts" : when === "now" ? "Post" : "Schedule"}
            </Button>
          </>
        }
      >
        <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-4 gap-y-2 text-[13.5px]">
          <dt className="text-(--muted)">Resource</dt>
          <dd className="font-semibold">
            {title} · v{version}
          </dd>
          <dt className="text-(--muted)">Classes</dt>
          <dd>{picked.map((c) => classes.find((x) => x.id === c)?.name).join(", ")}</dd>
          <dt className="text-(--muted)">As</dt>
          <dd>{postAs === "assignment" ? "Assignment" : "Material"}</dd>
          <dt className="text-(--muted)">Attached</dt>
          <dd>The student copy as a Google Doc; no answer key</dd>
        </dl>
      </Dialog>
    </div>
  );
}

function LmsPreview({ title, kind, version }: { title: string; kind: Draft["kind"]; version: number }) {
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-(--muted)">A simplified picture of the post, not Classroom&apos;s own screen.</p>
      <div className="rounded-(--r-md) border border-(--line) bg-white p-4">
        <p className="text-[11.5px] font-semibold tracking-wide text-(--muted) uppercase">{isQuestionKind(kind) ? "Assignment" : "Material"}</p>
        <p className="mt-1 text-[16px] font-bold">{title}</p>
        <p className="mt-1 text-[13px] text-(--ink-2)">{postDescription(kind, title, "")}</p>
        <div className="mt-3 flex items-center gap-3 rounded-(--r-sm) border border-(--line) p-2.5">
          <span className="flex h-10 w-8 items-center justify-center rounded-[3px] bg-[#e8f0fe] text-[10px] font-bold text-[#1a56c4]">DOC</span>
          <span className="min-w-0 text-[13px]">
            <span className="block truncate font-semibold">
              {title} (v{version})
            </span>
            <span className="text-(--muted)">Google Doc · students can view</span>
          </span>
        </div>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-(--bg-sunk) px-2.5 py-1 text-[12px] font-semibold text-(--ink-2)">
          <LockIcon className="h-3.5 w-3.5" /> Draft · only you can see it until you post it
        </p>
      </div>
    </div>
  );
}
