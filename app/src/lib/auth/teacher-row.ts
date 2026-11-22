import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { teacherName, type Teacher } from "@/lib/auth/teacher-model";

type Db = SupabaseClient<Database>;
export type TeacherRow = Database["public"]["Tables"]["teachers"]["Row"];

/** The teacher's row, created on first sign-in (row-level security lets a teacher insert only their own). */
export async function ensureTeacherRow(supabase: Db, user: User): Promise<TeacherRow> {
  const read = () => supabase.from("teachers").select("*").eq("id", user.id).maybeSingle();
  const first = await read();
  if (first.error) throw new Error(`Could not read the teacher row: ${first.error.message}`);
  if (first.data) return first.data;
  const inserted = await supabase.from("teachers").insert({ id: user.id, name: teacherName(user.user_metadata) }).select("*").maybeSingle();
  if (inserted.data) return inserted.data;
  // Another request created it first (unique violation): read it again.
  const again = await read();
  if (again.data) return again.data;
  throw new Error(`Could not create the teacher row: ${inserted.error?.message ?? again.error?.message ?? "unknown error"}`);
}

export function toTeacher(user: User, row: TeacherRow): Teacher {
  return {
    id: user.id,
    email: user.email ?? null,
    provider: user.app_metadata?.provider === "google" ? "google" : "email",
    name: row.name,
    school: row.school,
    grades: [...row.grades].sort((a, b) => a - b),
    subjects: row.subjects,
    setupDone: row.setup_done_at !== null,
  };
}
