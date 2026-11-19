import type { Metadata } from "next";
import { Suspense } from "react";
import { CreateScreen } from "@/components/workspace/create";

export const metadata: Metadata = { title: "Create" };

export default function CreatePage() {
  return (
    <Suspense fallback={null}>
      <CreateScreen />
    </Suspense>
  );
}
