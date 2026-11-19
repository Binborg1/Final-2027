"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { KINDS, kindInfo } from "@/lib/resources/kinds";
import { formatWhen, reuseResource, useWorkspace } from "@/lib/resources/store";
import { LibraryIcon, PlusIcon, SearchIcon, UploadIcon } from "./icons";
import { Codes, KindIcon, ResourceState } from "./parts";
import { Crumbs, Loading, TopBar } from "./shell";
import { Button, Card, cx, EmptyState, inputClass, LinkButton, Notice, Segmented } from "./ui";

export function LibraryScreen() {
  const ws = useWorkspace();
  const router = useRouter();
  const params = useSearchParams();
  const reuse = params.get("reuse") === "1";
  const [q, setQ] = useState("");
  const [course, setCourse] = useState(params.get("course") ?? "all");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState<"all" | "draft" | "approved">("all");
  if (!ws.hydrated) return <Loading />;

  const courses = [...new Set(ws.resources.map((r) => r.courseName))];
  const list = [...ws.resources]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .filter(
      (r) =>
        (course === "all" || r.courseName === course) &&
        (type === "all" || r.kind === type) &&
        (status === "all" || (status === "approved" ? !!ws.drafts[r.id]?.approved : ws.drafts[r.id]?.status === "draft")) &&
        (!q.trim() || r.title.toLowerCase().includes(q.trim().toLowerCase())),
    );
  const groups = [...new Set(list.map((r) => `${r.courseName} › ${r.unitName}`))];

  return (
    <>
      <TopBar
        actions={
          <>
            <LinkButton href="/create?from=file" size="sm">
              <UploadIcon /> Start from a file
            </LinkButton>
            <LinkButton href="/create" size="sm" variant="primary">
              <PlusIcon /> Create
            </LinkButton>
          </>
        }
      >
        <Crumbs items={[{ label: "Library" }]} />
      </TopBar>
      <div className="mx-auto max-w-[1180px] px-4 py-7 md:px-6 lg:px-8">
        <h1 className="text-[28px] font-bold">Library</h1>
        <p className="mt-1 text-[14.5px] text-(--ink-2)">Everything you have made, by course and unit. Drafts stay with you; approved versions are what you publish.</p>

        {reuse && (
          <div className="mt-5">
            <Notice tone="info" title="Pick a resource to build on">
              Funza copies its settings and outcomes into a new brief. The original stays exactly as it is.
            </Notice>
          </div>
        )}

        {ws.resources.length === 0 ? (
          <div className="mt-6">
            <EmptyState icon={<LibraryIcon className="h-5 w-5" />} title="Nothing here yet" action={<LinkButton href="/create" variant="primary">Create your first resource</LinkButton>}>
              Resources you create are kept here, in this browser, with everything you publish from them.
            </EmptyState>
          </div>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-(--muted)" />
                <input type="search" aria-label="Search the library" placeholder="Search titles" value={q} onChange={(e) => setQ(e.target.value)} className={cx(inputClass, "h-9 pl-9")} />
              </div>
              <label className="sr-only" htmlFor="lib-course">
                Course
              </label>
              <select id="lib-course" value={course} onChange={(e) => setCourse(e.target.value)} className={cx(inputClass, "h-9 w-auto py-1")}>
                <option value="all">All courses</option>
                {courses.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <label className="sr-only" htmlFor="lib-type">
                Type
              </label>
              <select id="lib-type" value={type} onChange={(e) => setType(e.target.value)} className={cx(inputClass, "h-9 w-auto py-1")}>
                <option value="all">All types</option>
                {KINDS.map((k) => (
                  <option key={k.kind} value={k.kind}>
                    {k.label}
                  </option>
                ))}
              </select>
              <Segmented
                size="sm"
                label="Status"
                value={status}
                onChange={setStatus}
                options={[
                  { value: "all", label: "All" },
                  { value: "draft", label: "Drafts" },
                  { value: "approved", label: "Approved" },
                ]}
              />
            </div>

            <div className="mt-5 space-y-5">
              {list.length === 0 ? (
                <EmptyState
                  icon={<SearchIcon className="h-5 w-5" />}
                  title="Nothing matches"
                  action={
                    <Button
                      onClick={() => {
                        setQ("");
                        setCourse("all");
                        setType("all");
                        setStatus("all");
                      }}
                    >
                      Clear filters
                    </Button>
                  }
                >
                  Try fewer filters.
                </EmptyState>
              ) : (
                groups.map((g) => (
                  <Card key={g} className="overflow-hidden">
                    <div className="border-b border-(--line) bg-(--surface-2) px-4 py-2.5 text-[12.5px] text-(--muted)">
                      <b className="text-(--ink)">{g.split(" › ")[0]}</b> › {g.split(" › ")[1]}
                    </div>
                    <ul className="divide-y divide-(--line)">
                      {list
                        .filter((r) => `${r.courseName} › ${r.unitName}` === g)
                        .map((r) => {
                          const d = ws.drafts[r.id];
                          const last = r.deliveries[0];
                          return (
                            <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5">
                              <KindIcon kind={r.kind} />
                              <div className="min-w-0 flex-[1_1_16rem]">
                                <button type="button" onClick={() => router.push(`/resources/${r.id}`)} className="truncate text-left font-semibold hover:underline">
                                  {r.title}
                                </button>
                                <p className="text-[12.5px] text-(--muted)">
                                  {kindInfo(r.kind).label} · <Codes ids={r.outcomeIds} /> · edited {formatWhen(r.updatedAt)}
                                  {last && ` · last: ${last.what.toLowerCase()} (${last.where})`}
                                </p>
                              </div>
                              {d && <ResourceState draft={d} compact />}
                              <div className="flex gap-1.5">
                                {reuse ? (
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    onClick={() => {
                                      reuseResource(r.id);
                                      router.push("/create");
                                    }}
                                  >
                                    Reuse
                                  </Button>
                                ) : d?.approved ? (
                                  <LinkButton href={`/resources/${r.id}/deliver`} size="sm">
                                    Publish
                                  </LinkButton>
                                ) : (
                                  <LinkButton href={`/resources/${r.id}`} size="sm">
                                    Review
                                  </LinkButton>
                                )}
                              </div>
                            </li>
                          );
                        })}
                    </ul>
                  </Card>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
