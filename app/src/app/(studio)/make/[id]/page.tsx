import { requireTeacher } from "@/lib/auth/teacher";
import { Review } from "./Review";

export const metadata = { title: "Review" };

/** P1 Review: the draft lives in this teacher's browser storage until step 4. */
export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireTeacher({ next: `/make/${encodeURIComponent(id)}` });
  return <Review id={id.slice(0, 80)} />;
}
