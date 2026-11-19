import { useId } from "react";

/**
 * The Funza logo: the italic wordmark inside a teal orbit, with a teal dot and
 * an amber sparkle. Traced from the brand artwork (public/brand/funza-logo.png)
 * so it stays sharp at any size. `tone="light"` is for dark backgrounds (the
 * navy sidebar); `tone="dark"` for light ones.
 */
export function FunzaLogo({ tone = "dark", className = "", title = "Funza" }: { tone?: "dark" | "light"; className?: string; title?: string }) {
  const id = useId().replace(/:/g, "");
  const teal = "#2cc4a9";
  return (
    <svg viewBox="62 82 578 346" className={className} role="img" aria-label={title} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`${id}-low`} x1="120" y1="0" x2="410" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={teal} />
          <stop offset="0.75" stopColor={teal} />
          <stop offset="1" stopColor={teal} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-high`} x1="265" y1="0" x2="530" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={teal} stopOpacity="0" />
          <stop offset="0.35" stopColor={teal} />
          <stop offset="1" stopColor={teal} />
        </linearGradient>
      </defs>
      <path d="M127 345 C116 392 160 418 228 418 C292 418 352 402 408 380" fill="none" stroke={`url(#${id}-low)`} strokeWidth="9" strokeLinecap="round" />
      <path d="M266 192 C330 158 420 128 522 120" fill="none" stroke={`url(#${id}-high)`} strokeWidth="9" strokeLinecap="round" />
      <path d="M618 150 C632 172 628 196 610 216" fill="none" stroke={teal} strokeWidth="9" strokeLinecap="round" />
      <circle cx="538" cy="119" r="12" fill="#1bb79c" />
      <path d="M598 88 C601 112 606 118 630 122 C606 126 601 132 598 156 C595 132 590 126 566 122 C590 118 595 112 598 88 Z" fill="#f5b21f" />
      <text
        x="74"
        y="334"
        fontSize="188"
        fontStyle="italic"
        fontWeight="800"
        textLength="548"
        lengthAdjust="spacingAndGlyphs"
        fill={tone === "light" ? "#ffffff" : "#141a3d"}
        style={{ fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif" }}
      >
        Funza
      </text>
    </svg>
  );
}
