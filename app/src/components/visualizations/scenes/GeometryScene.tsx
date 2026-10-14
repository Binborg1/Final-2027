"use client";

import { motion } from "framer-motion";
import { fillTemplate } from "@/lib/visualizations/expr";
import { resolve, varsAt } from "@/lib/visualizations/generic/common";
import { shapesAt, type ResolvedShape } from "@/lib/visualizations/generic/geometryScene";
import type { GeometrySceneParams } from "@/lib/visualizations/types";
import { fade, fmt, move, palette, shorten, svgProps, ticks, type SceneProps } from "./shared";

const W = 520;
const H = 280;
const PLOT = { x: 30, y: 20, size: 240 };
const PANEL_X = 300;

type Pt = [number, number];

/** The centre a shape turns and scales about: its centroid, midpoint or own centre. */
function centreOf(s: ResolvedShape): Pt {
  if (s.center) return s.center;
  const n = s.points.length || 1;
  return [s.points.reduce((a, p) => a + p[0], 0) / n, s.points.reduce((a, p) => a + p[1], 0) / n];
}

/** Applies the transform of the stage in model space: scale and rotate about the centre, then slide. */
function apply(p: Pt, c: Pt, t: ResolvedShape["transform"]): Pt {
  const rad = (t.rotate * Math.PI) / 180;
  const px = (p[0] - c[0]) * t.scale;
  const py = (p[1] - c[1]) * t.scale;
  return [c[0] + px * Math.cos(rad) - py * Math.sin(rad) + t.dx, c[1] + px * Math.sin(rad) + py * Math.cos(rad) + t.dy];
}

export function GeometryScene({ params, step, reduce }: SceneProps<GeometrySceneParams>) {
  const [r0, r1] = params.range;
  const scale = PLOT.size / (r1 - r0);
  const sx = (x: number) => PLOT.x + (x - r0) * scale;
  const sy = (y: number) => PLOT.y + PLOT.size - (y - r0) * scale;
  const stage = params.stages[Math.min(step, params.stages.length - 1)];
  const vars = varsAt(params.parameters, stage);
  const shapes = shapesAt(params, step);
  const grid = ticks(r0, r1, 10);

  return (
    <svg {...svgProps} viewBox={`0 0 ${W} ${H}`} fontSize={9}>
      {/* grid */}
      <rect x={PLOT.x} y={PLOT.y} width={PLOT.size} height={PLOT.size} fill={palette.white} stroke={palette.line} strokeWidth="1.5" rx="6" />
      {grid.map((v) => (
        <g key={v}>
          <line x1={sx(v)} y1={PLOT.y} x2={sx(v)} y2={PLOT.y + PLOT.size} stroke={palette.lineSoft} strokeWidth="1" />
          <line x1={PLOT.x} y1={sy(v)} x2={PLOT.x + PLOT.size} y2={sy(v)} stroke={palette.lineSoft} strokeWidth="1" />
          <text x={sx(v)} y={PLOT.y + PLOT.size + 12} textAnchor="middle" fill={palette.muted} fontSize={8}>
            {fmt(v)}
          </text>
          <text x={PLOT.x - 5} y={sy(v) + 3} textAnchor="end" fill={palette.muted} fontSize={8}>
            {fmt(v)}
          </text>
        </g>
      ))}

      {/* shapes */}
      {shapes.map((s) => {
        const c = centreOf(s);
        const pts = s.points.map((p) => apply(p, c, s.transform));
        const centre = apply(c, c, s.transform);
        const common = { initial: false as const, transition: move(reduce) };
        const opacity = s.visible ? 1 : 0;
        if (s.kind === "polygon") {
          const points = pts.map((p) => `${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(" ");
          return (
            <g key={s.id}>
              <motion.polygon {...common} animate={{ points, opacity }} fill={palette.peach} fillOpacity="0.85" stroke={palette.coral} strokeWidth="2" strokeLinejoin="round" />
              {s.label && (
                <motion.text {...common} animate={{ attrX: sx(centre[0]), attrY: sy(centre[1]) + 3, opacity }} textAnchor="middle" fill={palette.ink} fontWeight={800}>
                  {shorten(s.label, 12)}
                </motion.text>
              )}
            </g>
          );
        }
        if (s.kind === "circle") {
          return (
            <g key={s.id}>
              <motion.circle {...common} animate={{ cx: sx(centre[0]), cy: sy(centre[1]), r: s.radius * s.transform.scale * scale, opacity }} fill={palette.sky} fillOpacity="0.8" stroke={palette.skyDark} strokeWidth="2" />
              {s.label && (
                <motion.text {...common} animate={{ attrX: sx(centre[0]), attrY: sy(centre[1]) + 3, opacity }} textAnchor="middle" fill={palette.ink} fontWeight={800}>
                  {shorten(s.label, 12)}
                </motion.text>
              )}
            </g>
          );
        }
        if (s.kind === "segment") {
          const [a, b] = pts.length >= 2 ? pts : [centre, centre];
          return (
            <g key={s.id}>
              <motion.line {...common} animate={{ x1: sx(a[0]), y1: sy(a[1]), x2: sx(b[0]), y2: sy(b[1]), opacity }} stroke={palette.lavenderDark} strokeWidth="2.5" strokeLinecap="round" />
              {s.label && (
                <motion.text {...common} animate={{ attrX: sx((a[0] + b[0]) / 2) + 6, attrY: sy((a[1] + b[1]) / 2) - 6, opacity }} fill={palette.lavenderDark} fontWeight={800}>
                  {shorten(s.label, 12)}
                </motion.text>
              )}
            </g>
          );
        }
        return (
          <g key={s.id}>
            <motion.circle {...common} animate={{ cx: sx(centre[0]), cy: sy(centre[1]), opacity }} r="4" fill={palette.ink} />
            {s.label && (
              <motion.text {...common} animate={{ attrX: sx(centre[0]) + 7, attrY: sy(centre[1]) - 6, opacity }} fill={palette.ink} fontWeight={800}>
                {shorten(s.label, 12)}
              </motion.text>
            )}
          </g>
        );
      })}

      {/* measurements for this step */}
      {stage?.measures.map((m, i) => {
        const a: Pt = [resolve(m.from[0], vars), resolve(m.from[1], vars)];
        const b: Pt = [resolve(m.to[0], vars), resolve(m.to[1], vars)];
        return (
          <motion.g key={`${stage.id}-${i}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={fade(reduce)}>
            <line x1={sx(a[0])} y1={sy(a[1])} x2={sx(b[0])} y2={sy(b[1])} stroke={palette.mintDark} strokeWidth="1.5" strokeDasharray="4 3" />
            <text x={sx((a[0] + b[0]) / 2)} y={sy((a[1] + b[1]) / 2) + 12} textAnchor="middle" fill={palette.mintDark} fontWeight={800}>
              {shorten(fillTemplate(m.label, vars), 16)}
            </text>
          </motion.g>
        );
      })}

      {/* side panel: what is on the grid, and the measurements */}
      <text x={PANEL_X} y={PLOT.y + 12} fill={palette.ink} fontSize={10} fontWeight={800}>
        On the grid
      </text>
      {shapes.map((s, i) => (
        <text key={s.id} x={PANEL_X} y={PLOT.y + 30 + i * 15} fill={s.visible ? palette.ink : palette.muted}>
          {shorten(
            `${s.label ?? s.id}: ${s.kind}${s.transform.dx || s.transform.dy ? `, moved (${fmt(s.transform.dx)}, ${fmt(s.transform.dy)})` : ""}${s.transform.rotate ? `, turned ${fmt(s.transform.rotate)} deg` : ""}${s.transform.scale !== 1 ? `, scaled x${fmt(s.transform.scale)}` : ""}`,
            40,
          )}
        </text>
      ))}
      {stage && stage.measures.length > 0 && (
        <g>
          <text x={PANEL_X} y={PLOT.y + 44 + shapes.length * 15} fill={palette.ink} fontSize={10} fontWeight={800}>
            Measurements
          </text>
          {stage.measures.map((m, i) => (
            <text key={i} x={PANEL_X} y={PLOT.y + 62 + shapes.length * 15 + i * 15} fill={palette.mintDark}>
              {shorten(fillTemplate(m.label, vars), 40)}
            </text>
          ))}
        </g>
      )}
    </svg>
  );
}
