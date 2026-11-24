import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

/**
 * Student pages (no account, no studio shell): joining a live session and
 * answering it. Built for phones first. Search engines are kept out.
 */

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#6b4f3a" };

export default function StudentLayout({ children }: { children: ReactNode }) {
  return <main className="flex min-h-dvh justify-center px-3 py-4 sm:items-center sm:px-6 sm:py-8">{children}</main>;
}
