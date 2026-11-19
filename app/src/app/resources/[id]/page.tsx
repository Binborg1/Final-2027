import type { Metadata } from "next";
import { ReviewScreen } from "@/components/workspace/review";

export const metadata: Metadata = { title: "Review" };

export default async function ResourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReviewScreen id={id} />;
}
