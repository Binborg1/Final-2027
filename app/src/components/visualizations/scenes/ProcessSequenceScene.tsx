"use client";

import { motion } from "framer-motion";
import { fillTemplate } from "@/lib/visualizations/expr";
import { varsAt } from "@/lib/visualizations/generic/common";
import type { ProcessSequenceParams } from "@/lib/visualizations/types";
import { fade, move, palette, shorten, svgProps, type SceneProps } from "./shared";

const W = 520;
const PER_ROW = 4;
const BOX = { w: 104, h: 38 };
const GAP = 26;
const ROW_H = 64;

export function ProcessSequenceScene({ params, step, reduce }: SceneProps<ProcessSequenceParams>) {
  const n = params.stages.length;
  const current = Math.min(step, n - 1);
  const rows = Math.ceil(n / PER_ROW);
  const maxFacts = Math.max(0, ...params.stages.map((s) => s.facts.length));
  const factsTop = 24 + rows * ROW_H;
  const height = factsTop + (maxFacts > 0 ? maxFacts * 17 + 22 : 8);
  const perRow = Math.min(n, PER_ROW);
  const rowWidth = perRow * BOX.w + (perRow - 1) * GAP;
  const left = (W - rowWidth) / 2;
  const centre = (i: number) => {
    const row = Math.floor(i / PER_ROW);
    const col = i % PER_ROW;
    // Rows snake back and forth so the arrow from one row to the next stays short.
    const x = row % 2 === 0 ? left + col * (BOX.w + GAP) + BOX.w / 2 : left + (perRow - 1 - col) * (BOX.w + GAP) + BOX.w / 2;
    return { x, y: 24 + row * ROW_H + BOX.h / 2 };
  };
  const stage = params.stages[current];
  const vars = varsAt(params.parameters, stage);
  const here = centre(current);

  return (
    <svg {...svgProps} viewBox={`0 0 ${W} ${height}`} fontSize={10}>
      <defs>
        <marker id="ps-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill={palette.line} />
        </marker>
      </defs>

      {/* arrows between consecutive steps */}
      {params.stages.slice(1).map((_, i) => {
        const a = centre(i);
        const b = centre(i + 1);
        const sameRow = a.y === b.y;
        const x1 = sameRow ? a.x + Math.sign(b.x - a.x) * (BOX.w / 2 + 2) : a.x;
        const x2 = sameRow ? b.x - Math.sign(b.x - a.x) * (BOX.w / 2 + 2) : b.x;
        const y1 = sameRow ? a.y : a.y + BOX.h / 2 + 2;
        const y2 = sameRow ? b.y : b.y - BOX.h / 2 - 2;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={palette.line} strokeWidth="1.5" markerEnd="url(#ps-arrow)" />;
      })}

      {/* the steps */}
      {params.stages.map((s, i) => {
        const p = centre(i);
        const state = i < current ? "done" : i === current ? "now" : "later";
        return (
          <g key={s.id}>
            <motion.rect
              x={p.x - BOX.w / 2}
              y={p.y - BOX.h / 2}
              width={BOX.w}
              height={BOX.h}
              rx="11"
              initial={false}
              animate={{
                fill: state === "now" ? palette.peach : state === "done" ? palette.mint : palette.white,
                stroke: state === "now" ? palette.coral : state === "done" ? palette.mintDark : palette.line,
              }}
              transition={fade(reduce)}
              strokeWidth="1.5"
            />
            <text x={p.x} y={p.y + 3.5} textAnchor="middle" fill={palette.ink} fontWeight={800}>
              {shorten(fillTemplate(s.title, varsAt(params.parameters, s)), 16)}
            </text>
            <text x={p.x - BOX.w / 2 + 8} y={p.y - BOX.h / 2 - 4} fill={palette.muted} fontSize={8}>
              {i + 1}
            </text>
          </g>
        );
      })}

      {/* the "you are here" dot */}
      <motion.circle r="5" initial={false} animate={{ cx: here.x + BOX.w / 2 - 2, cy: here.y - BOX.h / 2 + 2 }} transition={move(reduce)} fill={palette.coral} stroke={palette.white} strokeWidth="2" />

      {/* facts for the current step */}
      {stage && stage.facts.length > 0 && (
        <g>
          <line x1={40} y1={factsTop} x2={W - 40} y2={factsTop} stroke={palette.lineSoft} strokeWidth="1" />
          {stage.facts.map((f, i) => (
            <motion.text key={`${stage.id}-${i}`} x={44} y={factsTop + 18 + i * 17} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={fade(reduce)} fill={palette.ink}>
              <tspan fill={palette.muted}>{shorten(fillTemplate(f.label, vars), 28)}: </tspan>
              {shorten(fillTemplate(f.value, vars), 60)}
            </motion.text>
          ))}
        </g>
      )}
    </svg>
  );
}
