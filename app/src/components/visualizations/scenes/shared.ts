import type { Transition } from "framer-motion";

/** The Funza palette, as the SVG scenes need literal colours. Mirrors globals.css. */
export const palette = {
  ink: "#252525",
  muted: "#6b645c",
  line: "#cdbfae",
  lineSoft: "#eee3d4",
  coral: "#ff8055",
  coralDark: "#ea6a3f",
  peach: "#ffe3d3",
  peachDark: "#cf5a2e",
  sky: "#dbecfb",
  skyDark: "#2f6fb5",
  lavender: "#e9e2fb",
  lavenderDark: "#6f52bf",
  mint: "#d9f3e5",
  mintDark: "#1f8a5b",
  sand: "#fff3e3",
  blush: "#ffb3b3",
  white: "#ffffff",
} as const;

/** Series colours, in the order curves and tokens are listed. */
export const seriesColors = [palette.coralDark, palette.skyDark, palette.mintDark, palette.lavenderDark] as const;

export type SceneProps<P> = {
  params: P;
  /** Index of the step on screen. */
  step: number;
  /** The student prefers reduced motion: changes appear at once instead of tweening. */
  reduce: boolean;
};

/** Position changes: a soft spring, or instant under reduced motion. */
export function move(reduce: boolean): Transition {
  return reduce ? { duration: 0 } : { type: "spring", stiffness: 110, damping: 19, mass: 0.9 };
}

/** Appearances: a short fade, or instant under reduced motion. */
export function fade(reduce: boolean): Transition {
  return { duration: reduce ? 0 : 0.35, ease: "easeOut" };
}

export const svgProps = {
  className: "mx-auto h-auto w-full",
  fontFamily: "inherit",
  fontWeight: 700,
  "aria-hidden": true as const,
};

/** Round tick positions covering [min, max], about `count` of them. */
export function ticks(min: number, max: number, count = 5): number[] {
  if (!(max > min)) return [min];
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step / 1e6; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

export function shorten(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function fmt(n: number): string {
  if (!Number.isFinite(n)) return "?";
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}
