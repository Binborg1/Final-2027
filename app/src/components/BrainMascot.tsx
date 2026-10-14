"use client";

import { motion, useReducedMotion, type Transition } from "framer-motion";

export type Mood = "happy" | "thinking" | "sad" | "celebrating";

type Props = {
  mood?: Mood;
  size?: number;
  className?: string;
  /** Gentle floating motion; off by default so the mascot stays calm in lists. */
  animate?: boolean;
  /** Mouth moves while the tutor is speaking. */
  talking?: boolean;
  /** Occasional blink, for an idle mascot that should feel alive. */
  blink?: boolean;
};

const ink = "#252525";
const bobTransition: Transition = { duration: 3.6, repeat: Infinity, ease: "easeInOut" };
const talkTransition: Transition = { duration: 0.55, repeat: Infinity, ease: "easeInOut" };
const blinkAnimation = { scaleY: [1, 1, 0.12, 1, 1] };
const blinkTransition: Transition = { duration: 0.32, times: [0, 0.35, 0.5, 0.65, 1], repeat: Infinity, repeatDelay: 3.6 };
const centerBox = { transformBox: "fill-box", transformOrigin: "center" } as const;

/** Funza's hand-drawn brain mascot. The body floats while its shadow stays on the ground. */
export function BrainMascot({ mood = "happy", size = 120, className = "", animate = false, talking = false, blink = false }: Props) {
  const reduce = useReducedMotion();
  const bob = animate && !reduce;
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={className}
      role="img"
      aria-label={`Funza mascot, ${talking ? "talking" : mood}`}
      whileHover={reduce ? undefined : { scale: 1.05 }}
      transition={{ type: "spring", stiffness: 300, damping: 18 }}
    >
      <motion.ellipse
        cx="100"
        cy="186"
        rx="46"
        ry="7"
        fill={ink}
        animate={bob ? { rx: [46, 38, 46], opacity: [0.08, 0.05, 0.08] } : { rx: 46, opacity: 0.08 }}
        transition={bobTransition}
      />
      <motion.g animate={bob ? { y: [0, -7, 0] } : { y: 0 }} transition={bobTransition}>
        <rect x="72" y="160" width="24" height="18" rx="9" fill="#ea6a3f" stroke={ink} strokeWidth="3" />
        <rect x="104" y="160" width="24" height="18" rx="9" fill="#ea6a3f" stroke={ink} strokeWidth="3" />
        <path
          d="M100 24 C72 22 50 40 46 68 C30 76 24 100 36 118 C28 140 44 160 68 164 C80 178 112 180 122 166 C148 176 172 158 170 134 C186 122 184 96 170 84 C176 58 156 38 132 40 C124 28 112 24 100 24 Z"
          fill="#f6a584"
          stroke={ink}
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        <g fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" opacity="0.85">
          <path d="M100 28 C94 50 104 72 98 90" />
          <path d="M62 72 C72 62 84 72 78 86" />
          <path d="M122 66 C132 56 146 66 140 80" />
          <path d="M44 100 C40 110 44 120 50 126" />
          <path d="M156 98 C160 108 156 118 150 124" />
          <path d="M58 140 C66 132 76 142 70 154" />
          <path d="M130 140 C138 132 148 142 142 154" />
        </g>
        <ellipse cx="64" cy="124" rx="9" ry="5.5" fill="#ffb3b3" opacity="0.85" />
        <ellipse cx="136" cy="124" rx="9" ry="5.5" fill="#ffb3b3" opacity="0.85" />
        <Face mood={mood} talking={talking && !reduce} blink={blink && !reduce} />
      </motion.g>
    </motion.svg>
  );
}

function Eye({ cx, cy, r, blink }: { cx: number; cy: number; r: number; blink: boolean }) {
  return (
    <motion.g style={centerBox} animate={blink ? blinkAnimation : { scaleY: 1 }} transition={blink ? blinkTransition : undefined}>
      <circle cx={cx} cy={cy} r={r} fill={ink} />
      <circle cx={cx + 3} cy={cy - 4} r={r / 3} fill="#fff" />
    </motion.g>
  );
}

function TalkingMouth({ cy, rx, open }: { cy: number; rx: number; open: number }) {
  return (
    <motion.ellipse
      cx="100"
      cy={cy}
      rx={rx}
      fill={ink}
      animate={{ ry: [2, open, open * 0.45, open * 1.1, 2] }}
      transition={talkTransition}
    />
  );
}

function Face({ mood, talking, blink }: { mood: Mood; talking: boolean; blink: boolean }) {
  if (mood === "celebrating") {
    return (
      <g>
        <g fill="none" stroke={ink} strokeWidth="4" strokeLinecap="round">
          <path d="M70 108 Q80 98 90 108" />
          <path d="M110 108 Q120 98 130 108" />
        </g>
        <motion.g style={centerBox} animate={talking ? { scaleY: [1, 0.55, 1] } : { scaleY: 1 }} transition={talking ? talkTransition : undefined}>
          <path d="M84 124 Q100 148 116 124 Z" fill={ink} />
          <path d="M92 134 Q100 142 108 134 Z" fill="#ff8a8a" />
        </motion.g>
        <g fill="#ff8055">
          <path d="M36 40 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 l8 -3 z" />
          <path d="M166 30 l2.5 6 l6 2.5 l-6 2.5 l-2.5 6 l-2.5 -6 l-6 -2.5 l6 -2.5 z" />
          <path d="M178 70 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 z" />
        </g>
      </g>
    );
  }
  if (mood === "thinking") {
    return (
      <g>
        <g fill="none" stroke={ink} strokeWidth="3.5" strokeLinecap="round">
          <path d="M70 94 Q80 90 90 94" />
          <path d="M110 86 Q120 80 130 86" />
        </g>
        <Eye cx={80} cy={110} r={8} blink={blink} />
        <Eye cx={120} cy={108} r={9} blink={blink} />
        {talking ? (
          <TalkingMouth cy={134} rx={7} open={6} />
        ) : (
          <path d="M90 134 Q100 130 110 134" fill="none" stroke={ink} strokeWidth="3.5" strokeLinecap="round" />
        )}
      </g>
    );
  }
  if (mood === "sad") {
    return (
      <g>
        <g fill="none" stroke={ink} strokeWidth="3.5" strokeLinecap="round">
          <path d="M70 94 Q80 90 90 98" />
          <path d="M110 98 Q120 90 130 94" />
        </g>
        <Eye cx={80} cy={110} r={9} blink={blink} />
        <Eye cx={120} cy={110} r={9} blink={blink} />
        <path d="M86 138 Q100 126 114 138" fill="none" stroke={ink} strokeWidth="3.5" strokeLinecap="round" />
      </g>
    );
  }
  return (
    <g>
      <Eye cx={80} cy={108} r={9} blink={blink} />
      <Eye cx={120} cy={108} r={9} blink={blink} />
      {talking ? (
        <TalkingMouth cy={132} rx={9} open={8} />
      ) : (
        <path d="M86 128 Q100 142 114 128" fill="none" stroke={ink} strokeWidth="3.5" strokeLinecap="round" />
      )}
    </g>
  );
}
