"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import type { ComponentProps } from "react";
import { MotionLink, spring } from "@/components/motion";

type Variant = "primary" | "secondary" | "ghost";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-[box-shadow,background-color,color,border-color] duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-coral/30 disabled:cursor-not-allowed disabled:opacity-50";

/* Violet for the one primary action on a screen; white with a hairline border for the rest. */
const variants: Record<Variant, string> = {
  primary:
    "bg-linear-to-b from-[#6a4ff0] to-[#5b3fd9] text-white shadow-button hover:shadow-button-hover active:shadow-button-pressed",
  secondary: "border border-line bg-white text-charcoal shadow-secondary hover:border-[#d3ccbf] hover:bg-[#fbfaf7] active:shadow-secondary-pressed",
  ghost: "text-smoke hover:bg-sand hover:text-charcoal",
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
