"use client";

import { CircleAlert, CircleCheck, ExternalLink, GraduationCap, LoaderCircle, Printer, Send } from "lucide-react";
import { useState } from "react";
import { Button, ButtonLink, buttonClass } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ChoiceChip } from "@/components/ui/Chip";
import { Checkbox } from "@/components/ui/Field";
import { connectUrl, lmsClasses, type LmsClass } from "@/lib/lms/client";
import { publishToClassroom, type PublishEvent } from "@/lib/lms/publish";
import { refreshLms, useLms } from "@/lib/lms/useLms";
import { recordPublication } from "@/lib/resources/actions";
import { isQuestionKind } from "@/lib/resources/kinds";
import { postDescription } from "@/lib/resources/render";
import { recordDelivery } from "@/lib/resources/store";
import type { ResourceKind } from "@/lib/resources/types";
import { cn } from "@/lib/ui/cn";

/**
 * Publish an approved version (FR-29): print it or save it as a PDF, or post it to
 * Google Classroom. Both use the student copy the server builds from the saved,
 * approved version, so nothing unapproved can reach students.
 */
export function PublishPanel({ id, title, kind, version }: { id: string; title: string; kind: ResourceKind; version: number }) {
  const lms = useLms();
  const [classes, setClasses] = useState<LmsClass[] | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [postAs, setPostAs] = useState<"material" | "assignment">(isQuestionKind(kind) ? "assignment" : "material");
  const [when, setWhen] = useState<"draft" | "now">("draft");
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [events, setEvents] = useState<Record<string, PublishEvent>>({});
  const [fileId, setFileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadClasses() {
    setLoading(true);
    setError(null);
    const res = await lmsClasses();
    setLoading(false);
    if (!res.ok) {
      setError(res.message);
      if (res.reason === "expired" || res.reason === "not-connected") void refreshLms();
      return;
    }
    setClasses(res.data);
  }

  async function post() {
    const targets = (classes ?? []).filter((c) => chosen.includes(c.id)).map((c) => ({ id: c.id, name: c.section ? `${c.name} · ${c.section}` : c.name, link: c.link }));
    if (targets.length === 0) return setError("Choose at least one class.");
    setError(null);
    setPosting(true);
    setEvents({});
    const out = await publishToClassroom(targets, { doc: { resourceId: id }, title, fileId, postAs, when, description: postDescription(kind, title, "") }, (e) => setEvents((prev) => ({ ...prev, [e.classId]: e })));
    setPosting(false);
    if (out.fileId) setFileId(out.fileId);
    for (const r of out.results) {
      recordDelivery(id, { version, what: "Google Classroom", where: r.name, state: r.ok ? "done" : "failed", detail: r.message, link: r.link ?? undefined });
      if (r.ok) void recordPublication({ id, channel: "classroom", externalId: r.link ?? r.classId, live: when === "now" });
    }
    if (out.expired) void refreshLms();
  }

  return (
    <Card className="flex flex-col gap-4 px-6 pt-5 pb-5" aria-labelledby="publish-title">
      <CardHeader id="publish-title" title={`Publish version ${version}`} after={<span className="text-meta text-ink-2">The student copy has no answers or keys</span>} />

      <div className="flex flex-wrap items-center gap-3">
        <a href={`/make/${id}/print`} target="_blank" rel="noopener" className={buttonClass({ variant: "secondary" })}>
          <Printer aria-hidden size={18} strokeWidth={1.75} />
          Print or save as PDF
        </a>
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-4">
        <p className="flex items-center gap-2 text-row font-semibold">
          <GraduationCap aria-hidden size={18} strokeWidth={1.75} /> Google Classroom
        </p>
        {lms === null ? (
          <p className="text-body text-ink-2">Checking your Classroom connection…</p>
        ) : !lms.configured ? (
          <p className="text-body text-ink-2">Google Classroom isn’t set up on this Funza server. Print it instead.</p>
        ) : !lms.connected ? (
          <div>
            <ButtonLink href={connectUrl(`/make/${id}`)} variant="secondary" icon={GraduationCap}>
              Connect Google Classroom
            </ButtonLink>
          </div>
        ) : classes === null ? (
          <div>
            <Button variant="secondary" icon={loading ? LoaderCircle : GraduationCap} disabled={loading} onClick={() => void loadClasses()} className={loading ? "[&_svg]:animate-spin" : undefined}>
              {loading ? "Loading your classes…" : "Choose classes"}
            </Button>
          </div>
        ) : classes.length === 0 ? (
          <p className="text-body text-ink-2">No active classes were found in your Google Classroom.</p>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {classes.map((c) => {
                const e = events[c.id];
                return (
                  <li key={c.id} className="flex items-center gap-3 rounded-tile border border-white/80 bg-tile px-3.5 py-2.5">
                    <Checkbox id={`class-${c.id}`} checked={chosen.includes(c.id)} disabled={posting} onChange={() => setChosen((x) => (x.includes(c.id) ? x.filter((y) => y !== c.id) : [...x, c.id]))} />
                    <label htmlFor={`class-${c.id}`} className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-body font-semibold">{c.name}</span>
                      {e ? <span className={cn("text-meta", e.state === "failed" ? "text-red-ink" : e.state === "done" ? "text-sage-ink" : "text-ink-2")}>{e.message}</span> : c.section ? <span className="text-meta text-ink-2">{c.section}</span> : null}
                    </label>
                    {e?.state === "posting" ? <LoaderCircle aria-hidden size={16} className="shrink-0 animate-spin text-ink-2" /> : e?.state === "done" ? <CircleCheck aria-hidden size={16} className="shrink-0 text-sage" /> : e?.state === "failed" ? <CircleAlert aria-hidden size={16} className="shrink-0 text-red" /> : null}
                    {e?.state === "done" && e.link ? (
                      <a href={e.link} target="_blank" rel="noopener" aria-label={`Open the post in ${c.name}`} className="flex size-8 items-center justify-center rounded-full text-ink-2 hover:bg-white">
                        <ExternalLink aria-hidden size={15} />
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <div role="group" aria-label="Post as" className="flex flex-wrap gap-2">
              <ChoiceChip size="sm" selected={postAs === "assignment"} onClick={() => setPostAs("assignment")} disabled={posting}>
                Assignment
              </ChoiceChip>
              <ChoiceChip size="sm" selected={postAs === "material"} onClick={() => setPostAs("material")} disabled={posting}>
                Material
              </ChoiceChip>
              <span aria-hidden className="mx-1 w-px bg-ink/10" />
              <ChoiceChip size="sm" selected={when === "draft"} onClick={() => setWhen("draft")} disabled={posting}>
                Save as a draft in Classroom
              </ChoiceChip>
              <ChoiceChip size="sm" selected={when === "now"} onClick={() => setWhen("now")} disabled={posting}>
                Post now
              </ChoiceChip>
            </div>
            <div>
              <Button icon={Send} loading={posting} disabled={chosen.length === 0} onClick={() => void post()}>
                {when === "now" ? "Post" : "Save draft"} to {chosen.length || ""} class{chosen.length === 1 ? "" : "es"}
              </Button>
            </div>
          </>
        )}
        {error ? (
          <p role="alert" className="flex items-center gap-2 text-body font-medium text-red-ink">
            <CircleAlert aria-hidden size={16} /> {error}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
