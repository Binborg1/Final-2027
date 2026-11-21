import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Funza Teacher Studio", template: "%s · Funza" },
  description: "Prepare course materials with AI help and run live quizzes in class. For Saskatchewan Grade 10–12 teachers.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
