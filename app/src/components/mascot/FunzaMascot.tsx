"use client";

import { motion, useReducedMotion, type TargetAndTransition, type Transition } from "framer-motion";
import { BrainMascot, type Mood } from "@/components/BrainMascot";

/** What the tutor is doing. `talking` is layered on top of any state. */
export type MascotState = "idle" | "talking" | "thinking" | "hinting" | "celebrating";

type Props = { state: MascotState; talking?: boolean; size?: number };

const moods: Record<MascotState, Mood> = {
  idle: "happy",
  talking: "happy",
  thinking: "thinking",
  hinting: "happy",
  celebrating: "celebrating",
};

const settle: Transition = { type: "spring", stiffness: 260, damping: 20 };
const rest: TargetAndTransition = { y: 0, x: 0, rotate: 0, scale: 1 };

/** The tutor's body language: a small bounce for a hint, a bigger one for a win, a head tilt while thinking. */
function gestureFor(state: MascotState, reduce: boolean): { animate: TargetAndTransition; transition: Transition } {
  if (reduce) return { animate: rest, transition: settle };
  switch (state) {
    case "hinting":
      return { animate: { y: [0, -10, 0, -5, 0], rotate: [0, -4, 0, 4, 0] }, transition: { duration: 0.9 } };
    case "celebrating":
      return { animate: { y: [0, -16, 0, -8, 0], scale: [1, 1.07, 1, 1.03, 1] }, transition: { duration: 1.1 } };
    case "thinking":
      return { animate: { ...rest, rotate: -5, x: 2 }, transition: settle };
    default:
      return { animate: rest, transition: settle };
  }
}

export function FunzaMascot({ state, talking = false, size = 112 }: Props) {
  const reduce = useReducedMotion() ?? false;
  const gesture = gestureFor(state, reduce);
  return (
    <motion.div key={state} className="inline-block" animate={gesture.animate} transition={gesture.transition}>
      <BrainMascot
        mood={moods[state]}
        size={size}
        animate={state === "idle" || state === "talking"}
        talking={talking || state === "talking"}
        blink={state !== "celebrating"}
      />
    </motion.div>
  );
}
