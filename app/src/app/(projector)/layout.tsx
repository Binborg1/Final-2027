import type { Metadata } from "next";
import type { ReactNode } from "react";

/** The projector view: full screen, no studio shell. Each page checks the teacher itself. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function ProjectorLayout({ children }: { children: ReactNode }) {
  return <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-6 lg:px-12">{children}</main>;
}
