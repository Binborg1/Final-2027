import type { Metadata } from "next";
import { Suspense } from "react";
import { LibraryScreen } from "@/components/workspace/library";

export const metadata: Metadata = { title: "Library" };

export default function LibraryPage() {
  return (
    <Suspense fallback={null}>
      <LibraryScreen />
    </Suspense>
  );
}
