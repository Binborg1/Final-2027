import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { MotionProvider } from "@/components/motion";
import { Shell } from "@/components/workspace/shell";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

/** Headings: a clean, slightly geometric display face. The italic 800 is the logo's wordmark. */
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Funza", template: "%s · Funza" },
  description: "A teaching workspace for Saskatchewan Grade 10–12 teachers: curriculum-aligned resources you review, approve and post to your school's platform.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable} h-full antialiased`}>
      <body className="min-h-full">
        <MotionProvider>
          <Shell>{children}</Shell>
        </MotionProvider>
      </body>
    </html>
  );
}
