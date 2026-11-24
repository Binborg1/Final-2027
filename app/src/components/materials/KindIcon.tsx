import { ClipboardList, GraduationCap, ListChecks, NotebookText, Presentation, type LucideIcon } from "lucide-react";
import type { ResourceKind } from "@/lib/resources/types";
import { cn } from "@/lib/ui/cn";

const ICON: Record<ResourceKind, LucideIcon> = { notes: NotebookText, presentation: Presentation, quiz: ListChecks, test: ClipboardList, exam: GraduationCap };

/** A material's kind as an icon in a small white tile, beside its title in a list. */
export function KindIcon({ kind, className }: { kind: ResourceKind; className?: string }) {
  const Icon = ICON[kind];
  return (
    <span aria-hidden className={cn("flex size-10 shrink-0 items-center justify-center rounded-sm bg-white/85 text-accent", className)}>
      <Icon size={20} strokeWidth={1.6} />
    </span>
  );
}
