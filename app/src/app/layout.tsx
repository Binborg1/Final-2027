import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { MotionProvider, PageTransition } from "@/components/motion";
import { Sidebar } from "@/components/Sidebar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

/** Headings: a clean, slightly geometric display face. */
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Funza", template: "%s · Funza" },
  description: "Curriculum-aligned lessons teachers review and approve, and a tutor that teaches one concept at a time.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-cream text-charcoal md:flex-row">
        <MotionProvider>
          <Sidebar />
          <main className="min-w-0 flex-1">
            <div className="app-container mx-auto w-full px-5 py-6 md:px-8 md:py-9 lg:px-10">
              <PageTransition>{children}</PageTransition>
            </div>
          </main>
        </MotionProvider>
      </body>
    </html>
  );
}
