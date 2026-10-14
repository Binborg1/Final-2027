"use client";

import { motion } from "framer-motion";
import type { DiagramNode, DiagramToken, NodeDiagramParams } from "@/lib/visualizations/types";
import { fade, move, palette, seriesColors, shorten, svgProps, type SceneProps } from "./shared";

const W = 520;
const BOX = { w: 104, h: 36 };
const RADIUS = 24;

type Pos = { x: number; y: number };

/** Node centres for the chosen layout, and the height the drawing needs. */
export function layoutNodes(params: NodeDiagramParams): { positions: Record<string, Pos>; height: number } {
  const nodes = params.nodes;
  const positions: Record<string, Pos> = {};
  const n = nodes.length;
  switch (params.layout) {
    case "ring": {
      const cx = W / 2;
      const cy = 150;
      const r = 108;
      nodes.forEach((node, i) => {
        const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
        positions[node.id] = { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
      });
      return { positions, height: 300 };
    }
    case "tree": {
      const incoming = new Set(params.edges.map((e) => e.to));
      let roots = nodes.filter((node) => !incoming.has(node.id));
      if (roots.length === 0) roots = [nodes[0]];
      const level = new Map<string, number>();
      const queue = roots.map((r) => r.id);
      roots.forEach((r) => level.set(r.id, 0));
      while (queue.length > 0) {
        const id = queue.shift()!;
        for (const e of params.edges) {
          if (e.from === id && !level.has(e.to)) {
            level.set(e.to, (level.get(id) ?? 0) + 1);
            queue.push(e.to);
          }
        }
      }
      const deepest = Math.max(0, ...level.values());
      for (const node of nodes) if (!level.has(node.id)) level.set(node.id, deepest + 1);
      const levels = Math.max(...level.values()) + 1;
      const rows: DiagramNode[][] = Array.from({ length: levels }, () => []);
      for (const node of nodes) rows[level.get(node.id)!].push(node);
      rows.forEach((row, li) => {
        row.forEach((node, i) => {
          positions[node.id] = { x: 30 + ((i + 0.5) * (W - 60)) / row.length, y: 44 + li * 78 };
        });
      });
      return { positions, height: 44 + (levels - 1) * 78 + 50 };
    }
    case "free": {
      nodes.forEach((node, i) => {
        const x = node.x ?? ((i + 0.5) * 100) / n;
        const y = node.y ?? 50;
        positions[node.id] = { x: 60 + (x / 100) * (W - 120), y: 32 + (y / 100) * 236 };
      });
      return { positions, height: 300 };
    }
    default: {
      nodes.forEach((node, i) => {
        positions[node.id] = { x: 30 + ((i + 0.5) * (W - 60)) / n, y: 110 };
      });
      return { positions, height: 200 };
    }
  }
}

/** Where a straight edge meets the outline of a node, so arrowheads stay visible. */
function border(node: DiagramNode, from: Pos, to: Pos): Pos {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  let d = RADIUS + 2;
  if (node.kind === "box") {
    const tx = Math.abs(ux) < 1e-6 ? Infinity : BOX.w / 2 / Math.abs(ux);
    const ty = Math.abs(uy) < 1e-6 ? Infinity : BOX.h / 2 / Math.abs(uy);
    d = Math.min(tx, ty) + 3;
  }
  return { x: from.x + ux * d, y: from.y + uy * d };
}

/** The place of each token at a stage; a token missing from a stage keeps its last place but hides. */
export function tokenPlaces(params: NodeDiagramParams, step: number, positions: Record<string, Pos>): { id: string; label: string; x: number; y: number; visible: boolean; colour: string }[] {
  const ids: string[] = [];
  for (const s of params.stages) for (const t of s.tokens) if (!ids.includes(t.id)) ids.push(t.id);
  const current = params.stages[Math.min(step, params.stages.length - 1)];
  const place = (t: DiagramToken, stackIndex: number): Pos => {
    if (t.edge) {
      const a = positions[t.edge[0]];
      const b = positions[t.edge[1]];
      return { x: a.x + (b.x - a.x) * t.t, y: a.y + (b.y - a.y) * t.t - 14 };
    }
    const at = positions[t.at ?? ""] ?? { x: W / 2, y: 40 };
    const node = params.nodes.find((n) => n.id === t.at);
    const lift = node?.kind === "box" ? BOX.h / 2 + 14 : RADIUS + 14;
    return { x: at.x, y: at.y - lift - stackIndex * 18 };
  };
  return ids.map((id, i) => {
    const here = current?.tokens.find((t) => t.id === id);
    let token = here;
    if (!token) {
      for (let s = step - 1; s >= 0 && !token; s--) token = params.stages[s]?.tokens.find((t) => t.id === id);
      for (let s = step + 1; s < params.stages.length && !token; s++) token = params.stages[s]?.tokens.find((t) => t.id === id);
    }
    const stackIndex = here && here.at ? current.tokens.filter((t) => t.at === here.at).findIndex((t) => t.id === id) : 0;
    const pos = token ? place(token, Math.max(0, stackIndex)) : { x: W / 2, y: 20 };
    return { id, label: token?.label ?? id, x: pos.x, y: pos.y, visible: !!here, colour: seriesColors[i % seriesColors.length] };
  });
}

export function NodeDiagramScene({ params, step, reduce }: SceneProps<NodeDiagramParams>) {
  const { positions, height } = layoutNodes(params);
  const stage = params.stages[Math.min(step, params.stages.length - 1)];
  const lit = new Set(stage?.highlight ?? []);
  const litEdges = new Set((stage?.highlightEdges ?? []).map(([a, b]) => `${a}>${b}`));
  const tokens = tokenPlaces(params, step, positions);
  const byId = Object.fromEntries(params.nodes.map((n) => [n.id, n]));

  return (
    <svg {...svgProps} viewBox={`0 0 ${W} ${height}`} fontSize={10}>
      <defs>
        <marker id="nd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill={palette.line} />
        </marker>
        <marker id="nd-arrow-lit" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill={palette.coralDark} />
        </marker>
      </defs>

      {/* edges */}
      {params.edges.map((e, i) => {
        const a = positions[e.from];
        const b = positions[e.to];
        const start = border(byId[e.from], a, b);
        const end = border(byId[e.to], b, a);
        const on = litEdges.has(`${e.from}>${e.to}`);
        return (
          <g key={i}>
            <motion.line
              x1={start.x}
              y1={start.y}
              x2={end.x}
              y2={end.y}
              initial={false}
              animate={{ stroke: on ? palette.coralDark : palette.line, strokeWidth: on ? 2.5 : 1.5 }}
              transition={fade(reduce)}
              markerEnd={e.directed ? (on ? "url(#nd-arrow-lit)" : "url(#nd-arrow)") : undefined}
            />
            {e.label && (
              <g>
                <rect x={(start.x + end.x) / 2 - e.label.length * 2.8 - 4} y={(start.y + end.y) / 2 - 8} width={e.label.length * 5.6 + 8} height="14" rx="4" fill={palette.white} opacity="0.9" />
                <text x={(start.x + end.x) / 2} y={(start.y + end.y) / 2 + 3} textAnchor="middle" fill={on ? palette.coralDark : palette.muted} fontSize={9}>
                  {shorten(e.label, 20)}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* nodes */}
      {params.nodes.map((node) => {
        const p = positions[node.id];
        const on = lit.has(node.id);
        return (
          <g key={node.id}>
            {node.kind === "circle" ? (
              <motion.circle cx={p.x} cy={p.y} r={RADIUS} initial={false} animate={{ fill: on ? palette.peach : palette.white, stroke: on ? palette.coral : palette.line }} transition={fade(reduce)} strokeWidth="1.5" />
            ) : (
              <motion.rect x={p.x - BOX.w / 2} y={p.y - BOX.h / 2} width={BOX.w} height={BOX.h} rx="10" initial={false} animate={{ fill: on ? palette.peach : palette.white, stroke: on ? palette.coral : palette.line }} transition={fade(reduce)} strokeWidth="1.5" />
            )}
            <text x={p.x} y={p.y + 3.5} textAnchor="middle" fill={palette.ink} fontWeight={800}>
              {shorten(node.label, node.kind === "circle" ? 9 : 18)}
            </text>
          </g>
        );
      })}

      {/* moving items */}
      {tokens.map((t) => (
        <motion.g key={t.id} initial={false} animate={{ x: t.x, y: t.y, opacity: t.visible ? 1 : 0 }} transition={move(reduce)}>
          <rect x={-t.label.length * 2.9 - 6} y={-8} width={t.label.length * 5.8 + 12} height="16" rx="8" fill={t.colour} />
          <text y={3.5} textAnchor="middle" fill={palette.white} fontSize={9}>
            {shorten(t.label, 12)}
          </text>
        </motion.g>
      ))}
    </svg>
  );
}
