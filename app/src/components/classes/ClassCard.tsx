"use client";

import { accents } from "@/components/CourseCard";
import { cardClass, lift, MotionLink, press, spring } from "@/components/motion";

/** A class on the home page (student) or the Teach page (professor). */
export function ClassCard({
  href,
  name,
  detail,
  code,
  index = 0,
}: {
  href: string;
  name: string;
  detail: string;
  code: string;
  index?: number;
}) {
  const accent = accents[(index + 1) % accents.length];
  return (
    <MotionLink href={href} whileHover={lift} whileTap={press} transition={spring} className={`block p-5 ${cardClass}`}>
      <div className="flex items-center gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-lg font-extrabold shadow-edge ${accent.bg} ${accent.text}`}
          aria-hidden="true"
        >
          {name.trim().charAt(0).toUpperCase() || "?"}
        </span>
        <div className="min-w-0">
          <h3 className="text-base leading-tight font-extrabold">{name}</h3>
          <p className="text-sm text-smoke">{detail}</p>
        </div>
      </div>
      <p className="mt-4 text-xs font-bold text-smoke">
        Code <span className="tracking-widest text-charcoal">{code}</span>
      </p>
    </MotionLink>
  );
}
