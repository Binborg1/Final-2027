import { History, Info, PenLine, Printer, Radio } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { buttonClass, ButtonLink } from "@/components/ui/Button";
import { Card, CardHeader, Overline } from "@/components/ui/Card";
import { ChipLink, StatusChip, Tag } from "@/components/ui/Chip";
import { requireTeacher } from "@/lib/auth/teacher";
import { idSchema } from "@/lib/courses/model";
import { loadDataset } from "@/lib/curriculum/dataset";
import { codeOf } from "@/lib/curriculum/sources";
import { libraryItem } from "@/lib/library/data";
import { CHANNEL_LABEL, longDate, shortDate } from "@/lib/library/model";
import { allItems, totalMarks } from "@/lib/resources/checks";
import { isQuestionKind, kindInfo } from "@/lib/resources/kinds";
import { cn } from "@/lib/ui/cn";
import { MaterialDocument } from "./MaterialDocument";

export const metadata = { title: "Library" };

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * One approved material, read-only: the teacher copy or the student copy of the
 * version on screen (?v=N, the latest approved by default), its versions and where
 * each went. Editing still happens in Review, where approval and publishing are.
 */
export default async function LibraryItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Search> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  await requireTeacher({ next: `/library/${encodeURIComponent(id)}` });
  if (!idSchema.safeParse(id).success) notFound();
  const v = Number(one(sp.v));
  const wanted = Number.isInteger(v) && v > 0 ? v : null;
  const student = one(sp.view) === "student";

  const item = await libraryItem(id.toLowerCase(), wanted);
  if (item === "unapproved") redirect(`/make/${id}`);
  if (!item) notFound();

  const { shown, latest, draft } = item;
  const doc = shown.draft;
  const isLatest = shown.number === latest.number;
  const count = allItems(doc).length;
  const meta = [kindInfo(item.kind).label, `${doc.sections.length} ${item.kind === "presentation" ? "slide" : "section"}${doc.sections.length === 1 ? "" : "s"}`, count > 0 ? `${count} question${count === 1 ? "" : "s"}` : null, count > 0 ? `${totalMarks(doc)} marks` : null, doc.duration && isQuestionKind(item.kind) ? `${doc.duration} min` : null]
    .filter(Boolean)
    .join(" · ");
  loadDataset(); // outcome codes
  const codes = [...new Set(doc.outcomeIds.map(codeOf).filter(Boolean))];
  const here = (patch: { v?: number | null; student?: boolean }) => {
    const p = new URLSearchParams();
    const n = patch.v === undefined ? (isLatest ? null : shown.number) : patch.v;
    if (n) p.set("v", String(n));
    if (patch.student ?? student) p.set("view", "student");
    const q = p.toString();
    return `/library/${item.id}${q ? `?${q}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        crumbs={[{ label: "Library", href: "/library" }, { label: item.course.title, href: `/library?course=${item.course.id}` }, { label: doc.title }]}
        size="title-sm"
        title={doc.title}
        summary={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <StatusChip status={item.isCurrent && item.status === "published" ? "published" : "approved"} />
            <span className="inline-flex h-6 items-center rounded-sm border border-white/90 bg-white/55 px-2 text-badge font-semibold">v{shown.number}</span>
            <span className="text-body font-medium">{meta}</span>
            <span className="text-body font-medium text-ink-2">Approved {longDate(shown.at)}</span>
          </span>
        }
        actions={
          <>
            {isQuestionKind(item.kind) && item.isCurrent ? (
              <ButtonLink variant="secondary" icon={Radio} href={`/live/new?quiz=${item.id}`}>
                Run live
              </ButtonLink>
            ) : null}
            <ButtonLink variant="secondary" icon={PenLine} href={`/make/${item.id}`}>
              {draft ? `Open draft v${draft}` : "Open in Review"}
            </ButtonLink>
            {/* A plain link: the student copy opens in a new tab, as from Publish. */}
            <a href={`/make/${item.id}/print?v=${shown.number}`} target="_blank" rel="noopener" className={buttonClass({ variant: "primary" })}>
              <Printer aria-hidden size={18} strokeWidth={1.75} className="shrink-0" />
              Print or save as PDF
            </a>
          </>
        }
      />

      {!isLatest ? (
        <Notice>
          This is version {shown.number}. Version {latest.number} is the latest approved.{" "}
          <Link href={here({ v: null })} className="font-semibold underline">
            See version {latest.number}
          </Link>
        </Notice>
      ) : draft ? (
        <Notice>Version {draft} is being edited in Review. This approved version stays as it is.</Notice>
      ) : null}

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="flex flex-col gap-5 px-8 pt-6 pb-8 max-sm:px-4" aria-label={student ? "Student copy" : "Teacher copy"}>
          <div className="flex flex-wrap items-center gap-2">
            <ChipLink href={here({ student: false })} selected={!student} size="md">
              Teacher copy
            </ChipLink>
            <ChipLink href={here({ student: true })} selected={student} size="md">
              Student copy
            </ChipLink>
            <span className="text-meta text-ink-2 max-sm:basis-full">{student ? "What students get: no answers, keys, solutions or rubrics." : "Everything, with answers, solutions and rubrics."}</span>
          </div>
          {isQuestionKind(item.kind) ? (
            <p className="border-b border-line pb-4 text-body">
              <span className="font-semibold">Total:</span> {totalMarks(doc)} marks
              {doc.duration ? (
                <>
                  {" "}
                  · <span className="font-semibold">Time:</span> {doc.duration} minutes
                </>
              ) : null}
            </p>
          ) : null}
          <MaterialDocument kind={item.kind} sections={doc.sections} style={shown.style} teacher={!student} />
        </Card>

        <div className="flex flex-col gap-5">
          <Card className="flex flex-col gap-3 px-6 pt-5 pb-5" aria-labelledby="versions-title">
            <CardHeader id="versions-title" title="Versions" after={<History aria-hidden size={18} className="text-ink-2" />} />
            <ol className="flex flex-col gap-2">
              {item.history.map((h) => {
                const showing = h.versionId === shown.versionId;
                const body = (
                  <>
                    <span className="flex items-center gap-2">
                      <span className="text-body font-semibold">v{h.number}</span>
                      <span className="text-body">{h.approvedAt ? `Approved ${shortDate(h.approvedAt)}` : "Draft in Review"}</span>
                      {showing ? <span className="ml-auto text-meta font-semibold text-accent-ink">Showing</span> : null}
                    </span>
                    {h.posts.map((p) => (
                      <span key={p.channel} className="text-meta text-ink-2">
                        {CHANNEL_LABEL[p.channel]} · {shortDate(p.at)}
                      </span>
                    ))}
                  </>
                );
                const shape = cn("flex flex-col gap-0.5 rounded-tile border px-3.5 py-2.5", showing ? "border-white bg-white/85" : "border-white/80 bg-tile hover:bg-white/80");
                return (
                  <li key={h.versionId}>
                    {showing ? (
                      <div aria-current="true" className={shape}>
                        {body}
                      </div>
                    ) : (
                      <Link href={h.approvedAt ? here({ v: h.number === latest.number ? null : h.number }) : `/make/${item.id}`} className={shape}>
                        {body}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
          </Card>

          <Card className="flex flex-col gap-4 px-6 pt-5 pb-5" aria-labelledby="details-title">
            <CardHeader id="details-title" title="Details" />
            <Detail label="Course">
              <Link href={`/courses/${item.course.id}`} className="font-semibold text-accent-ink hover:underline">
                {item.course.title}
              </Link>
            </Detail>
            {item.chapters.length > 0 ? (
              <Detail label={item.chapters.length === 1 ? "Chapter" : "Chapters"}>
                <ul className="flex flex-col gap-1">
                  {item.chapters.map((c) => (
                    <li key={c.id}>
                      <Link href={`/courses/${item.course.id}/chapters/${c.id}`} className="font-semibold text-accent-ink hover:underline">
                        {c.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Detail>
            ) : null}
            {codes.length > 0 ? (
              <Detail label="Outcomes">
                <span className="flex flex-wrap gap-1.5">
                  {codes.map((c) => (
                    <Tag key={c}>{c}</Tag>
                  ))}
                </span>
              </Detail>
            ) : null}
            <Detail label="First made">{longDate(item.createdAt)}</Detail>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="flex items-start gap-3 rounded-tile bg-amber-tint px-4 py-3 text-body text-amber-ink">
      <Info aria-hidden size={18} className="mt-px shrink-0" />
      <p>{children}</p>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 text-body">
      <Overline>{label}</Overline>
      <div>{children}</div>
    </div>
  );
}
