import { lmsCreateDoc, lmsPost } from "@/lib/lms/client";

/**
 * Posting one approved version to Google Classroom, without any screen code.
 * One Google Doc (the student copy, never the answer key) is created in the
 * teacher's Drive and shared by every class it is posted to. A post counts only
 * when Classroom confirms it. The first expired token stops the run, since every
 * later call would fail the same way. The caller shows progress from the events
 * and records deliveries from the results.
 */

export type PublishTarget = { id: string; name: string; link: string | null };

export type PublishOptions = {
  doc: Parameters<typeof lmsCreateDoc>[0];
  /** A Doc already made for this version, reused instead of making another. */
  fileId: string | null;
  postAs: "material" | "assignment";
  when: "draft" | "now" | "schedule";
  /** ISO time, used when `when` is "schedule". */
  scheduledTime?: string;
  /** Only when posting to a single class. */
  topicId?: string;
  description: string;
};

export type PublishEvent = { classId: string; state: "posting" | "done" | "failed"; message: string; link?: string | null };

export type PublishResult = { classId: string; name: string; ok: boolean; message: string; link: string | null };

type Api = { createDoc: typeof lmsCreateDoc; post: typeof lmsPost };

export async function publishToClassroom(
  targets: PublishTarget[],
  opts: PublishOptions,
  onEvent: (e: PublishEvent) => void = () => {},
  api: Api = { createDoc: lmsCreateDoc, post: lmsPost },
): Promise<{ fileId: string | null; results: PublishResult[]; expired: boolean }> {
  let fileId = opts.fileId;
  if (!fileId) {
    targets.forEach((t) => onEvent({ classId: t.id, state: "posting", message: "Creating the student copy as a Google Doc in your Drive" }));
    const doc = await api.createDoc(opts.doc);
    if (!doc.ok) {
      const message = `The document could not be created: ${doc.message}`;
      targets.forEach((t) => onEvent({ classId: t.id, state: "failed", message }));
      return { fileId: null, results: targets.map((t) => ({ classId: t.id, name: t.name, ok: false, message, link: null })), expired: doc.reason === "expired" };
    }
    fileId = doc.data.id;
  }

  const results: PublishResult[] = [];
  let expired = false;
  for (const t of targets) {
    if (expired) {
      const message = "Not posted: the Classroom connection expired. Connect again and retry.";
      onEvent({ classId: t.id, state: "failed", message });
      results.push({ classId: t.id, name: t.name, ok: false, message, link: null });
      continue;
    }
    onEvent({ classId: t.id, state: "posting", message: opts.when === "draft" ? "Creating a draft post" : "Creating the post" });
    const res = await api.post({
      courseId: t.id,
      fileId,
      kind: opts.postAs,
      title: opts.doc.title,
      description: opts.description,
      state: opts.when === "now" ? "PUBLISHED" : "DRAFT",
      topicId: targets.length === 1 ? opts.topicId : undefined,
      scheduledTime: opts.when === "schedule" ? opts.scheduledTime : undefined,
    });
    if (res.ok) {
      const message =
        res.data.state === "DRAFT"
          ? opts.when === "schedule"
            ? "Classroom confirmed the post is scheduled"
            : "Classroom confirmed the draft. Students see it only after you post it there."
          : "Classroom confirmed the post. Students can see it now.";
      const link = res.data.link ?? t.link;
      onEvent({ classId: t.id, state: "done", message, link });
      results.push({ classId: t.id, name: t.name, ok: true, message, link });
    } else {
      const message = `Classroom refused the request: ${res.message}`;
      onEvent({ classId: t.id, state: "failed", message });
      results.push({ classId: t.id, name: t.name, ok: false, message, link: null });
      expired = res.reason === "expired";
    }
  }
  return { fileId, results, expired };
}
