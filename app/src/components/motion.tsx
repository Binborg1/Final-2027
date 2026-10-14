"use client";

import { motion, MotionConfig, type HTMLMotionProps, type Variants } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/* One spring for every hover and press, so the whole app moves the same way. */
export const spring = { type: "spring", stiffness: 420, damping: 32, mass: 0.8 } as const;
export const lift = { y: -4, scale: 1.012 } as const;
export const press = { scale: 0.985 } as const;

export const MotionLink = motion.create(Link);

/** Honours the OS "reduce motion" setting for every animation below. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/** Fades each page in on navigation. */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export const staggerList: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

export const riseItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 320, damping: 28 } },
};

/** A container whose Item children rise in one after another. */
export function Stagger(props: HTMLMotionProps<"div">) {
  return <motion.div variants={staggerList} initial="hidden" animate="show" {...props} />;
}

export function Item(props: HTMLMotionProps<"div">) {
  return <motion.div variants={riseItem} {...props} />;
}

/** Rises into place on mount. */
export function Rise(props: HTMLMotionProps<"div">) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      {...props}
    />
  );
}

/** The card surface: soft gradient, layered shadow, deeper shadow on hover. */
export const cardClass =
  "rounded-3xl border border-line bg-linear-to-b from-white to-[#fff6ea] shadow-card transition-shadow duration-300 hover:shadow-card-hover";

/** A card that lifts and scales a touch under the pointer. */
export function LiftCard({ className = "", ...rest }: HTMLMotionProps<"div">) {
  return <motion.div whileHover={lift} whileTap={press} transition={spring} className={`${cardClass} ${className}`} {...rest} />;
}
