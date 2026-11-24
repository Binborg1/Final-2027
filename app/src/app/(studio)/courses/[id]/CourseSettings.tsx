"use client";

import { Check, CircleAlert, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Disclosure } from "@/components/ui/Disclosure";
import { Field, Input } from "@/components/ui/Field";
import { deleteCourse, renameCourse } from "@/lib/courses/actions";

/** Rename or delete the course, collapsed by default. */
export function CourseSettings({ courseId, title }: { courseId: string; title: string }) {
  const router = useRouter();
  const [name, setName] = useState(title);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <Disclosure title="Course settings" summary="Rename or delete this course">
      <div className="flex flex-col gap-4 pt-2">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await renameCourse(courseId, name);
              setMessage(res.ok ? { tone: "ok", text: "Saved." } : { tone: "bad", text: res.message });
              if (res.ok) router.refresh();
            });
          }}
        >
          <Field id="course-name" label="Course name" className="min-w-64 flex-1">
            <Input id="course-name" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Button type="submit" variant="secondary" icon={Check} loading={pending}>
            Save name
          </Button>
        </form>
        {message ? (
          <p role={message.tone === "bad" ? "alert" : "status"} className={message.tone === "bad" ? "flex items-center gap-2 text-body font-medium text-red-ink" : "text-body font-semibold text-sage-ink"}>
            {message.tone === "bad" ? <CircleAlert aria-hidden size={16} /> : null}
            {message.text}
          </p>
        ) : null}
        <div>
          <Button variant="ghost" icon={Trash2} onClick={() => setConfirming(true)}>
            Delete this course
          </Button>
        </div>
      </div>
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        labelledBy="delete-course-title"
        title={`Delete “${title}”?`}
        description="Its chapters and materials are deleted. Questions in its bank stay in your account, marked retired. This can’t be undone."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={pending}>
              Cancel
            </Button>
            <Button
              icon={Trash2}
              loading={pending}
              onClick={() =>
                start(async () => {
                  const res = await deleteCourse(courseId);
                  if (!res.ok) {
                    setConfirming(false);
                    setMessage({ tone: "bad", text: res.message });
                    return;
                  }
                  router.push("/courses");
                })
              }
            >
              Delete course
            </Button>
          </>
        }
      />
    </Disclosure>
  );
}
