/** What a teacher page knows about the signed-in teacher. Safe to pass to Client Components. */
export type Teacher = {
  id: string;
  email: string | null;
  provider: "google" | "email";
  name: string;
  school: string;
  grades: number[];
  subjects: string[];
  setupDone: boolean;
};

/** The name from the Google profile; email sign-ins start without one and give it in setup. */
export function teacherName(metadata: Record<string, unknown> | undefined): string {
  for (const key of ["full_name", "name"]) {
    const v = metadata?.[key];
    if (typeof v === "string" && v.trim()) return v.trim().replace(/\s+/g, " ").slice(0, 200);
  }
  return "";
}

/** "Jordan" from "Jordan Bergen"; the email's local part when there is no name yet. */
export function firstName(t: Pick<Teacher, "name" | "email">): string {
  const n = t.name.trim().split(/\s+/)[0];
  if (n) return n;
  return t.email?.split("@")[0] ?? "";
}

/** "JB" from "Jordan Bergen". */
export function initials(t: Pick<Teacher, "name" | "email">): string {
  const parts = t.name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (t.email?.[0] ?? "?").toUpperCase();
}
