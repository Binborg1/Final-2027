import { LogOut } from "lucide-react";
import { cn } from "@/lib/ui/cn";

/** Sign out is a plain form POST to /auth/sign-out (refused from other sites), so it works without JavaScript. */
export function SignOutForm({ id, className, label = "Sign out" }: { id?: string; className?: string; label?: string }) {
  return (
    <form id={id} method="post" action="/auth/sign-out" className={cn(!label && "hidden")}>
      {label ? (
        <button type="submit" className={cn("flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left text-row font-medium text-ink hover:bg-white/70", className)}>
          <LogOut aria-hidden size={18} strokeWidth={1.6} />
          {label}
        </button>
      ) : null}
    </form>
  );
}
