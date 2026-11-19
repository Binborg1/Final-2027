"use client";

import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { connectUrl, lmsDisconnect } from "@/lib/lms/client";
import { refreshLms, useLms } from "@/lib/lms/useLms";
import { toast } from "@/lib/resources/store";
import { LockIcon, PlugIcon, XIcon } from "./icons";
import { Crumbs, TopBar } from "./shell";
import { Button, Card, cx, Notice, Pill, Skeleton } from "./ui";

export function IntegrationsScreen() {
  const lms = useLms();
  const params = useSearchParams();
  const result = params.get("lms");
  const [busy, setBusy] = useState(false);
  const rows: [string, ReactNode, ReactNode, ReactNode, ReactNode, ReactNode][] = [
    ["Google Classroom", "Yes", "Yes", "Yes", "Yes", <span key="q" className="text-(--bad)">No: needs Google Forms</span>],
    ["Microsoft Teams", "Planned", "Planned", "To assess", "To assess", "To assess"],
    ["Canvas", "Planned", "Planned", "To assess", "To assess", "To assess"],
    ["Moodle", "Planned", "Planned", "To assess", "To assess", "To assess"],
  ];
  return (
    <>
      <TopBar>
        <Crumbs items={[{ label: "Integrations" }]} />
      </TopBar>
      <div className="mx-auto max-w-[980px] px-4 py-7 md:px-6 lg:px-8">
        <h1 className="text-[28px] font-bold">Integrations</h1>
        <p className="mt-1 text-[14.5px] text-(--ink-2)">Funza creates and you approve; the platform your school already uses delivers to students. Everything you publish goes there.</p>

        {result === "connected" && (
          <div className="mt-5">
            <Notice tone="ok">Google Classroom is connected.</Notice>
          </div>
        )}
        {result === "blocked" && (
          <div className="mt-5">
            <Notice tone="gold" title="Your school has not allowed Funza yet">
              Google said your Workspace admin must approve Funza before teachers can connect it.
            </Notice>
          </div>
        )}
        {(result === "error" || result === "cancelled") && (
          <div className="mt-5">
            <Notice tone={result === "error" ? "bad" : "info"}>{result === "error" ? "Google did not connect. Try again." : "You cancelled at Google, so nothing was connected."}</Notice>
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card className="p-5 md:col-span-2">
            <div className="flex flex-wrap items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-(--r-md) bg-(--bg-sunk)">
                <PlugIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[16px] font-bold">Google Classroom</h2>
                  {lms === null ? (
                    <Skeleton className="h-5 w-24" />
                  ) : (
                    <Pill tone={lms.connected ? "ok" : "none"}>{lms.connected ? "Connected" : lms.configured ? "Not connected" : "Not set up on this server"}</Pill>
                  )}
                </div>
                <p className="mt-1 text-[13px] text-(--ink-2)">Posts approved resources as Google Docs attached to materials or assignments, as drafts by default. Answer keys are never attached to student posts.</p>
              </div>
              {lms?.connected ? (
                <Button
                  loading={busy}
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    await lmsDisconnect();
                    await refreshLms();
                    setBusy(false);
                    toast("Google Classroom disconnected. Funza's access was revoked.", "info");
                  }}
                >
                  Disconnect
                </Button>
              ) : lms?.configured ? (
                <a href={connectUrl("/integrations")} className="inline-flex h-9 items-center rounded-(--r-md) bg-(--teal-700) px-3.5 text-sm font-semibold text-white shadow-(--sh-teal) hover:bg-(--teal-800)">
                  Connect
                </a>
              ) : null}
            </div>
            {lms && !lms.configured && (
              <div className="mt-4">
                <Notice tone="none" title="For whoever runs this Funza server">
                  Create an OAuth client (type “Web application”) in a Google Cloud project with the Classroom and Drive APIs enabled, add <code>{"<this site>/api/lms/google/callback"}</code> as an authorized redirect URI, then set <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code> and a random <code>FUNZA_SESSION_SECRET</code> of at least 32 characters. Full steps: docs/09_teacher_workspace_design/07_lms_publishing_ux.md.
                </Notice>
              </div>
            )}
          </Card>
          {["Microsoft Teams", "Canvas", "Moodle"].map((p) => (
            <Card key={p} className="p-5">
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-bold text-(--ink-2)">{p}</h2>
                <Pill tone="none">Planned</Pill>
              </div>
              <p className="mt-1 text-[13px] text-(--muted)">Not built yet. Tell us if your school uses it, so it is built first.</p>
            </Card>
          ))}
        </div>

        <h2 className="mt-9 text-[16px] font-bold">What each connection can do</h2>
        <div className="mt-3 overflow-x-auto rounded-(--r-lg) border border-(--line) bg-(--surface)">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead className="bg-(--surface-2) text-[12px] text-(--muted)">
              <tr>
                {["Platform", "Post material", "Post assignment", "Draft first", "Schedule", "Auto-graded quiz"].map((h) => (
                  <th key={h} scope="col" className="px-3 py-2.5 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-(--line)">
              {rows.map(([name, ...cells]) => (
                <tr key={name}>
                  <th scope="row" className="px-3 py-2.5 font-semibold">
                    {name}
                  </th>
                  {cells.map((c, i) => (
                    <td key={i} className={cx("px-3 py-2.5", (c === "To assess" || c === "Planned") && "text-(--muted)")}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Card className="mt-6 p-5">
          <h2 className="flex items-center gap-2 text-[15px] font-bold">
            <LockIcon className="h-4 w-4" /> What Funza never touches
          </h2>
          <ul className="mt-2 grid gap-1.5 text-[13px] text-(--ink-2) sm:grid-cols-2">
            {["Class rosters and student names", "Grades and student submissions", "Files in your Drive it did not create", "Anything you have not approved"].map((x) => (
              <li key={x} className="flex items-center gap-2">
                <XIcon className="h-3.5 w-3.5 text-(--bad)" /> {x}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
