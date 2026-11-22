import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import type { ReactNode } from "react";
import { Backdrop } from "@/components/shell/Backdrop";
import "./globals.css";

const figtree = Figtree({ subsets: ["latin"], display: "swap", variable: "--font-figtree" });

export const metadata: Metadata = {
  title: { default: "Funza Teacher Studio", template: "%s · Funza" },
  description: "Prepare course materials with AI help and run live quizzes in class. For Saskatchewan Grade 10–12 teachers.",
};

export const viewport: Viewport = { themeColor: "#6b4f3a" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-CA" className={`${figtree.variable} h-full antialiased`}>
      <body className="min-h-full font-sans text-ink">
        <Backdrop />
        {children}
      </body>
    </html>
  );
}
