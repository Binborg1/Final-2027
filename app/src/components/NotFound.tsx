"use client";

import { BrainMascot } from "@/components/BrainMascot";
import { ButtonLink } from "@/components/Button";
import { Rise } from "@/components/motion";

export function NotFound({ what }: { what: string }) {
  return (
    <Rise className="flex flex-col items-center rounded-3xl border border-dashed border-line bg-white/60 p-10 text-center">
      <BrainMascot mood="sad" size={110} animate />
      <p className="mt-4 text-lg font-extrabold">This {what} does not exist in this browser.</p>
      <p className="mt-1 max-w-md text-sm text-smoke">
        Courses and progress are stored locally, so a link from another device will not open here.
      </p>
      <ButtonLink href="/" className="mt-6">
        Go to My Courses
      </ButtonLink>
    </Rise>
  );
}
