"use client";

import { useParams } from "next/navigation";
import { ClassGate } from "@/components/classes/ui";
import { CurriculumExplorer } from "@/components/curriculum/CurriculumExplorer";
import { normalizeCode } from "@/lib/classes/model";
import { editKeyFor } from "@/lib/classes/client";
import { useHydrated } from "@/lib/storage";

/** The explorer opened from a class: lessons are added to that class. */
export default function ClassCurriculumPage() {
  const { code: rawCode } = useParams<{ code: string }>();
  const code = normalizeCode(rawCode);
  const hydrated = useHydrated();
  if (!hydrated) return null;
  if (!editKeyFor(code)) return <ClassGate load={{ status: "no-key" }} code={code} />;
  return <CurriculumExplorer fixedClassCode={code} />;
}
