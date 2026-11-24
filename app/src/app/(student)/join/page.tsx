import type { Metadata } from "next";
import { normalizeCode } from "@/lib/live/code";
import { JoinCard } from "./JoinCard";

export const metadata: Metadata = { title: "Join a live session" };

/** The QR code on the projector opens this page with the code filled in (/join?code=K7QM4P). */
export default async function JoinPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const code = typeof sp.code === "string" ? normalizeCode(sp.code).slice(0, 6) : "";
  return <JoinCard initialCode={code} />;
}
