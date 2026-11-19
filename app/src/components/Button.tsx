"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import type { ComponentProps } from "react";
import { MotionLink, spring } from "@/components/motion";

type Variant = "primary" | "secondary" | "ghost" | "inverse" | "glass";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-[box-shadow,background-color,color,border-color] duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-coral/30 disabled:cursor-not-allowed disabled:opacity-50";

/* Violet for the one primary action on a screen; white with a hairline border for the rest. */
const variants: Record<Variant, string> = {
  primary:
    "bg-linear-to-b from-[#6a4ff0] to-[#5b3fd9] text-white shadow-button hover:shadow-button-hover active:shadow-button-pressed",
  secondary: "border border-line bg-white text-charcoal shadow-secondary hover:border-[#d3ccbf] hover:bg-[#fbfaf7] active:shadow-secondary-pressed",
  ghost: "text-smoke hover:bg-sand hover:text-charcoal",
  /* For the navy hero bands: a white primary and a frosted secondary. */
  inverse:
    "bg-white text-navy-900 shadow-[0_1px_2px_rgba(0,0,0,0.25),0_8px_20px_-8px_rgba(0,0,0,0.5)] hover:bg-[#f4f2ff] focus-visible:ring-white/40",
  glass: "border border-white/15 bg-white/10 text-white backdrop-blur-sm hover:border-white/25 hover:bg-white/15 focus-visible:ring-white/30",
};

export function buttonClass(variant: Variant = "primary", className = "") {
  return `${base} ${variants[variant]} ${className}`;
}

const hover = { y: -1 };
const tap = { y: 1, scale: 0.99 };

type ButtonProps = HTMLMotionProps<"button"> & { variant?: Variant };

export function Button({ variant = "primary", className = "", disabled, ...rest }: ButtonProps) {
  const raised = variant !== "ghost" && !disabled;
  return (
    <motion.button
      whileHover={raised ? hover : undefined}
      whileTap={raised ? tap : undefined}
      transition={spring}
      className={buttonClass(variant, className)}
      disabled={disabled}
      {...rest}
    />
  );
}

type ButtonLinkProps = ComponentProps<typeof MotionLink> & { variant?: Variant };

/** A Next.js Link that looks and moves like a Button. */
export function ButtonLink({ variant = "primary", className = "", ...rest }: ButtonLinkProps) {
  return <MotionLink whileHover={hover} whileTap={tap} transition={spring} className={buttonClass(variant, className)} {...rest} />;
}
