import { requireTeacher } from "@/lib/auth/teacher";
import { Review } from "./Review";

export const metadata = { title: "Review" };

/** P1 Review: the draft is loaded from the database into the browser workspace (lib/resources/store.ts). */
export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireTeacher({ next: `/make/${encodeURIComponent(id)}` });
  return <Review id={id.slice(0, 80)} />;
}
