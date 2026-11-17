import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Usability questionnaire",
  description: "Eight minutes, anonymous. Help the Funza team improve the design.",
};

export default function SurveyLayout({ children }: { children: ReactNode }) {
  return children;
}
