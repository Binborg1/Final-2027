import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { QrCode } from "@/components/ui/QrCode";
import { requireTeacher } from "@/lib/auth/teacher";
import { snapshot } from "@/lib/live/handlers/teacher";
import type { ConsoleSnapshot } from "@/lib/live/payload";
import { ping } from "@/lib/live/ping";
import { teacherStore } from "@/lib/live/store-supabase";
import { Console } from "./Console";

export const metadata: Metadata = { title: "Live session" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The live console on the teacher's laptop: the lobby, answering, checking marks and Reveal (Figma L2–L4). */
export default async function LiveConsolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireTeacher({ next: `/live/${id}` });
  if (!UUID.test(id)) notFound();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const result = await snapshot({ store: teacherStore(supabase), now: Date.now, ping }, id.toLowerCase(), origin);
  if (!result.body.ok) notFound();
  const snap = result.body.data as ConsoleSnapshot;
  if (snap.session.state === "ended") redirect(`/live/${snap.session.id}/results`);
  const course = await supabase.from("courses").select("title").eq("id", snap.session.courseId).maybeSingle();
  const chapter = snap.session.chapterId ? await supabase.from("chapters").select("title").eq("id", snap.session.chapterId).maybeSingle() : null;
  return (
    <Console
      initial={snap}
      courseTitle={course.data?.title ?? null}
      chapterTitle={chapter?.data?.title ?? null}
      qr={<QrCode value={snap.session.joinUrl} label={`QR code to join with code ${snap.session.code}`} className="size-40" />}
    />
  );
}
