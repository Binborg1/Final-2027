import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Play } from "./Play";

export const metadata: Metadata = { title: "Live session" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A student's phone during a live session: wait, answer, then see their own result. */
export default async function PlayPage({ params }: { params: Promise<{ session: string }> }) {
  const { session } = await params;
  if (!UUID.test(session)) notFound();
  return <Play sessionId={session.toLowerCase()} />;
}
