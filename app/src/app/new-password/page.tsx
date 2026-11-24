import type { Metadata } from "next";
import { requireTeacher } from "@/lib/auth/teacher";
import { NewPasswordCard } from "./NewPasswordCard";

export const metadata: Metadata = { title: "Choose a new password" };

/**
 * Where a password-reset link lands (signed in by /auth/confirm), and where
 * Settings' "Change password" goes. A teacher who hasn't finished setup can use it;
 * afterwards Home sends them on to setup.
 */
export default async function NewPasswordPage() {
  const { teacher } = await requireTeacher({ next: "/new-password", allowSetup: true });
  return (
    <main className="flex min-h-dvh items-center justify-center px-3 py-6 sm:px-6">
      <NewPasswordCard email={teacher.email} after={teacher.setupDone ? "/settings?password=saved" : "/setup"} />
    </main>
  );
}
