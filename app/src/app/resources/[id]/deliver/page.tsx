import type { Metadata } from "next";
import { Suspense } from "react";
import { DeliverScreen } from "@/components/workspace/deliver";

export const metadata: Metadata = { title: "Publish" };

export default async function DeliverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={null}>
      <DeliverScreen id={id} />
    </Suspense>
  );
}
