import type { Metadata } from "next";
import { Suspense } from "react";
import { CurriculumScreen } from "@/components/workspace/curriculum";

export const metadata: Metadata = { title: "Curriculum" };

export default function CurriculumPage() {
  return (
    <Suspense fallback={null}>
      <CurriculumScreen />
    </Suspense>
  );
}
