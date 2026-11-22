import { NextResponse } from "next/server";
import { adminClient } from "@/lib/db/admin";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Says whether this deployment can reach its database. It answers only
 * "reachable" or "unreachable": no rows, counts or settings leave the server.
 */
export async function GET() {
  try {
    const { error } = await adminClient().from("teachers").select("id", { head: true }).limit(1);
    if (error) throw error;
    return NextResponse.json({ ok: true, database: "reachable" }, { headers: NO_STORE });
  } catch (error) {
    const reason = error && typeof error === "object" && "message" in error ? String(error.message) : "unknown error";
    console.error("Health check: the database is unreachable:", reason);
    return NextResponse.json({ ok: false, database: "unreachable" }, { status: 503, headers: NO_STORE });
  }
}
