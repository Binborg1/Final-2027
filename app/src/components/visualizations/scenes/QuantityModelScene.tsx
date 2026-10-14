"use client";

import { motion } from "framer-motion";
import { quantityValues } from "@/lib/visualizations/generic/quantityModel";
import type { QuantityModelParams } from "@/lib/visualizations/types";
import { fade, fmt, move, palette, shorten, svgProps, ticks, type SceneProps } from "./shared";

const W = 520;
const H = 240;
const L = 44;
const R = 16;
const T = 30;
const B = 44;

export function QuantityModelScene({ params, step, reduce }: SceneProps<QuantityModelParams>) {
  const values = quantityValues(params, step);
  const stage = params.stages[Math.min(step, params.stages.length - 1)];
  const lit = new Set(stage?.highlight ?? []);
  const n = params.quantities.length;
  const top = params.max ?? Math.max(1e-9, ...Object.values(values)) * 1.15;
  const max = top > 0 ? top : 1;
  const plotW = W - L - R;
  const plotH = H - T - B;
  const slot = plotW / n;
  const barW = Math.min(64, slot * 0.64);
  const sy = (v: number) => T + plotH - (Math.min(Math.max(v, 0), max) / max) * plotH;

  return (
    <svg {...svgProps} viewBox={`0 0 ${W} ${H}`} fontSize={10}>
      {/* scale */}
      {ticks(0, max, 4).map((v) => (
        <g key={v}>
          <line x1={L} y1={sy(v)} x2={W - R} y2={sy(v)} stroke={palette.lineSoft} strokeWidth="1" />
          <text x={L - 6} y={sy(v) + 3} textAnchor="end" fill={palette.muted} fontSize={9}>
            {fmt(v)}
          </text>
        </g>
      ))}
      <line x1={L} y1={T + plotH} x2={W - R} y2={T + plotH} stroke={palette.line} strokeWidth="1.5" />

      {/* bars */}
      {params.quantities.map((q, i) => {
        const v = values[q.id] ?? 0;
        const x = L + slot * i + (slot - barW) / 2;
        const y = sy(v);
        const on = lit.has(q.id);
        return (
          <g key={q.id}>
            <motion.rect
              x={x}
              width={barW}
              rx="6"
              initial={false}
              animate={{ attrY: y, height: Math.max(0, T + plotH - y), fill: on ? palette.coral : palette.sky, stroke: on ? palette.coralDark : palette.skyDark }}
              transition={move(reduce)}
              strokeWidth="1.5"
            />
            <motion.text x={x + barW / 2} textAnchor="middle" initial={false} animate={{ attrY: y - 6 }} transition={move(reduce)} fill={on ? palette.coralDark : palette.ink} fontWeight={800}>
              {fmt(v)}
              {q.unit ? ` ${q.unit}` : ""}
            </motion.text>
            <motion.text x={x + barW / 2} y={T + plotH + 16} textAnchor="middle" initial={false} animate={{ fill: on ? palette.coralDark : palette.muted }} transition={fade(reduce)} fontSize={9}>
              {shorten(q.label, Math.max(6, Math.floor(slot / 5.5)))}
            </motion.text>
          </g>
        );
      })}
    </svg>
  );
}
