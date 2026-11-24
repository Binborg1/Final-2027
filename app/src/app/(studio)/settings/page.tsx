import { PageHeader } from "@/components/shell/PageHeader";
import { TabDock } from "@/components/shell/TabDock";
import { requireTeacher } from "@/lib/auth/teacher";
import { loadDataset } from "@/lib/curriculum/dataset";
import { googleConfig } from "@/lib/lms/session";
import { SettingsCards } from "./SettingsCards";

export const metadata = { title: "Settings" };

/** A3 Settings: profile, Google Classroom, and how Funza looks after student data. */
export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ teacher }, sp] = await Promise.all([requireTeacher({ next: "/settings" }), searchParams]);
  const curriculum = loadDataset().summaries.map((s) => ({ id: s.id, name: s.name, subject: s.subject, levels: s.levels, units: s.units }));
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Settings" summary="Your account, Google Classroom and how Funza looks after student data." />
      <SettingsCards teacher={teacher} curriculum={curriculum} classroomConfigured={!!googleConfig()} lmsResult={typeof sp.lms === "string" ? sp.lms : null} passwordSaved={sp.password === "saved"} />
      <TabDock
        tabs={[
          { id: "profile", label: "Profile" },
          { id: "classroom", label: "Google Classroom" },
          { id: "student-data", label: "Student data" },
        ]}
      />
    </div>
  );
}
