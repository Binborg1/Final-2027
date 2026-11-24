import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { QrCode } from "@/components/ui/QrCode";
import { requireTeacher } from "@/lib/auth/teacher";
import { snapshot } from "@/lib/live/handlers/teacher";
import type { ScreenSnapshot } from "@/lib/live/payload";
import { ping } from "@/lib/live/ping";
import { teacherStore } from "@/lib/live/store-supabase";
import { Projector } from "./Projector";

export const metadata: Metadata = { title: "Projector" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * What the class sees (Figma L4 and the lobby): the QR code and join code, the
 * clock, then the answers one question at a time. Never a name.
 */
export default async function ProjectorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireTeacher({ next: `/live/${id}/screen` });
  if (!UUID.test(id)) notFound();
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const result = await snapshot({ store: teacherStore(supabase), now: Date.now, ping }, id.toLowerCase(), origin, "screen");
  if (!result.body.ok) notFound();
  const snap = result.body.data as ScreenSnapshot;
  const course = await supabase.from("courses").select("title").eq("id", snap.session.courseId).maybeSingle();
  return <Projector initial={snap} courseTitle={course.data?.title ?? null} qr={<QrCode value={snap.session.joinUrl} label={`QR code to join with code ${snap.session.code}`} className="aspect-square w-full max-w-[min(42vh,420px)]" />} />;
}
