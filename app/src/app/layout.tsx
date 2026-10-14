import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { MotionProvider, PageTransition } from "@/components/motion";
import { Sidebar } from "@/components/Sidebar";

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Funza", template: "%s · Funza" },
  description: "Learn concepts from your own course materials, one step at a time.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${nunito.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-cream text-charcoal md:flex-row">
        <MotionProvider>
          <Sidebar />
          <main className="min-w-0 flex-1">
            <div className="mx-auto w-full max-w-5xl px-5 py-6 md:px-10 md:py-10">
              <PageTransition>{children}</PageTransition>
            </div>
          </main>
        </MotionProvider>
      </body>
    </html>
  );
}
