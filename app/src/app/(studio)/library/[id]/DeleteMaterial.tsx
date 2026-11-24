"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { deleteResource, toast } from "@/lib/resources/store";

/**
 * Deletes the material from the teacher's account, for good, after a confirm
 * dialog that says what goes and what stays. Goes through the browser workspace so
 * Home's lists drop it at once.
 */
export function DeleteMaterial({ id, title, versions, assessment }: { id: string; title: string; versions: number; assessment: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    const ok = await deleteResource(id);
    setBusy(false);
    if (!ok) return; // the store shows why
    setOpen(false);
    toast(`Deleted “${title}”.`);
    router.push("/library");
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-9 items-center gap-1.5 self-start rounded-full px-3 text-body font-semibold text-red-ink hover:bg-white/55 pointer-coarse:h-11">
        <Trash2 aria-hidden size={16} strokeWidth={1.75} />
        Delete this material
      </button>
      <Dialog
        open={open}
        onClose={() => !busy && setOpen(false)}
        labelledBy="delete-material-title"
        title={`Delete “${title}”?`}
        description={[
          `It’s removed from your account for good: ${versions === 1 ? "its version" : `all ${versions} versions`} and the record of where ${versions === 1 ? "it was" : "they were"} printed or posted.`,
          assessment ? "Its questions are retired from your question bank, unless another material uses them." : null,
          "Copies already printed or posted to Google Classroom stay where they are. This can’t be undone.",
        ]
          .filter(Boolean)
          .join(" ")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button icon={Trash2} loading={busy} onClick={confirm}>
              Delete material
            </Button>
          </>
        }
      />
    </>
  );
}
