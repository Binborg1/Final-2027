"use client";

import { motion } from "framer-motion";
import { varsAt } from "@/lib/visualizations/generic/common";
import { curveValue, GRAPH_LIMITS, markerAt } from "@/lib/visualizations/generic/functionGraph";
import type { FunctionGraphParams } from "@/lib/visualizations/types";
import { fade, fmt, move, palette, seriesColors, shorten, svgProps, ticks, type SceneProps } from "./shared";

const W = 520;
const H = 260;
const L = 50;
const R = 16;
const T = 16;
const B = 38;

export function FunctionGraphScene({ params, step, reduce }: SceneProps<FunctionGraphParams>) {
  const stage = params.stages[Math.min(step, params.stages.length - 1)];
  const vars = varsAt(params.parameters, stage);
  const [x0, x1] = params.xRange;
  const visible = new Set(stage?.show ?? params.curves.map((c) => c.id));

  const n = GRAPH_LIMITS.samples;
  const sampled = params.curves.map((curve) => ({
    curve,
    points: Array.from({ length: n + 1 }, (_, i) => {
      const x = x0 + ((x1 - x0) * i) / n;
      return [x, curveValue(params, curve.id, x, vars)] as const;
    }),
  }));

  // The y range: as given, or fitted to what is visible, with a little headroom.
  let [y0, y1] = params.yRange ?? [NaN, NaN];
  if (!params.yRange) {
    const ys = [
      ...sampled.filter((s) => visible.has(s.curve.id)).flatMap((s) => s.points.map((p) => p[1])),
      ...params.points.map((p) => p.y),
    ].filter((y) => Number.isFinite(y) && Math.abs(y) < 1e6);
    if (ys.length === 0) [y0, y1] = [-1, 1];
    else {
      const lo = Math.min(...ys, 0);
      const hi = Math.max(...ys, 0);
      const pad = (hi - lo || 1) * 0.1;
      [y0, y1] = [lo - pad, hi + pad];
    }
  }
  const sx = (x: number) => L + ((x - x0) / (x1 - x0)) * (W - L - R);
  const sy = (y: number) => T + ((y1 - y) / (y1 - y0)) * (H - T - B);
  const axisX = sy(Math.min(Math.max(0, y0), y1)); // the x axis sits at y = 0 when that is in view, else at the nearest edge
  const axisY = sx(Math.min(Math.max(0, x0), x1));

  const pathOf = (points: readonly (readonly [number, number])[]) => {
    let d = "";
    let pen = false;
    const span = (y1 - y0) * 4;
    for (const [x, y] of points) {
      if (!Number.isFinite(y) || y < y0 - span || y > y1 + span) {
        pen = false;
        continue;
      }
      d += `${pen ? "L" : "M"}${sx(x).toFixed(1)} ${sy(y).toFixed(1)} `;
      pen = true;
    }
    return d;
  };

  const marker = markerAt(params, step);
  const mx = marker ? sx(marker.x) : axisY;
  const my = marker ? sy(marker.y) : axisX;
  const showGuides = !!marker && !!stage?.guides;

  return (
    <svg {...svgProps} viewBox={`0 0 ${W} ${H}`} fontSize={9}>
      <defs>
        <clipPath id="fg-clip">
          <rect x={L} y={T} width={W - L - R} height={H - T - B} />
        </clipPath>
      </defs>

      {/* grid and axes */}
      {ticks(x0, x1).map((v) => (
        <g key={`x${v}`}>
          <line x1={sx(v)} y1={T} x2={sx(v)} y2={H - B} stroke={palette.lineSoft} strokeWidth="1" />
          <text x={sx(v)} y={H - B + 14} textAnchor="middle" fill={palette.muted}>
            {fmt(v)}
          </text>
        </g>
      ))}
      {ticks(y0, y1).map((v) => (
        <g key={`y${v}`}>
          <line x1={L} y1={sy(v)} x2={W - R} y2={sy(v)} stroke={palette.lineSoft} strokeWidth="1" />
          <text x={L - 6} y={sy(v) + 3} textAnchor="end" fill={palette.muted}>
            {fmt(v)}
          </text>
        </g>
      ))}
      <line x1={L} y1={axisX} x2={W - R} y2={axisX} stroke={palette.line} strokeWidth="1.5" />
      <line x1={axisY} y1={T} x2={axisY} y2={H - B} stroke={palette.line} strokeWidth="1.5" />
      <text x={W - R} y={H - B + 28} textAnchor="end" fill={palette.ink}>
        {params.xLabel}
      </text>
      <text x={L + 4} y={T + 10} fill={palette.ink}>
        {params.yLabel}
      </text>

      {/* curves */}
      <g clipPath="url(#fg-clip)">
        {sampled.map((s, i) => (
          <motion.path
            key={s.curve.id}
            d={pathOf(s.points)}
            fill="none"
            stroke={seriesColors[i % seriesColors.length]}
            strokeWidth="2.2"
            strokeLinejoin="round"
            initial={false}
            animate={{ opacity: visible.has(s.curve.id) ? 1 : 0 }}
            transition={fade(reduce)}
          />
        ))}
        {params.points.map((p, i) => (
          <g key={i}>
            <circle cx={sx(p.x)} cy={sy(p.y)} r="3.5" fill={palette.white} stroke={palette.ink} strokeWidth="1.5" />
            {p.label && (
              <text x={sx(p.x) + 6} y={sy(p.y) - 5} fill={palette.ink}>
                {shorten(p.label, 18)}
              </text>
            )}
          </g>
        ))}
      </g>

      {/* legend */}
      {params.curves.length > 1 &&
        params.curves.map((c, i) => (
          <g key={c.id} opacity={visible.has(c.id) ? 1 : 0.35}>
            <rect x={W - R - 118} y={T + 6 + i * 14} width="10" height="3" rx="1.5" fill={seriesColors[i % seriesColors.length]} />
            <text x={W - R - 104} y={T + 10 + i * 14} fill={palette.ink}>
              {shorten(c.label, 22)}
            </text>
          </g>
        ))}

      {/* marker with guides */}
      <motion.g initial={false} animate={{ opacity: showGuides ? 1 : 0 }} transition={fade(reduce)}>
        <motion.line initial={false} animate={{ x1: mx, x2: mx, y1: my, y2: axisX }} transition={move(reduce)} stroke={palette.coralDark} strokeWidth="1" strokeDasharray="3 3" />
        <motion.line initial={false} animate={{ x1: axisY, x2: mx, y1: my, y2: my }} transition={move(reduce)} stroke={palette.coralDark} strokeWidth="1" strokeDasharray="3 3" />
        <motion.text initial={false} animate={{ attrX: mx + 6, attrY: Math.min(my, axisX) - 8 }} transition={move(reduce)} fill={palette.coralDark} fontSize={10}>
          {marker ? `(${fmt(marker.x)}, ${fmt(marker.y)})` : ""}
        </motion.text>
      </motion.g>
      <motion.circle r="5.5" initial={false} animate={{ cx: mx, cy: my, opacity: marker ? 1 : 0 }} transition={move(reduce)} fill={palette.coral} stroke={palette.white} strokeWidth="2" />
    </svg>
  );
}
