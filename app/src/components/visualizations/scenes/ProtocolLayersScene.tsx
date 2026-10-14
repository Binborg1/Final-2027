"use client";

import { motion } from "framer-motion";
import { headersAt, layersOf, positionAt } from "@/lib/visualizations/protocolLayers";
import type { ProtocolLayersParams } from "@/lib/visualizations/types";
import { fade, move, palette, svgProps, type SceneProps } from "./shared";

const SENDER_X = 16;
const RECEIVER_X = 284;
const STACK_W = 220;
const TOP = 20;
const GAP = 4;

const headerFill: Record<string, string> = {
  TCP: palette.sky,
  TH: palette.sky,
  IP: palette.lavender,
  NH: palette.lavender,
  ETH: palette.mint,
  DH: palette.mint,
  PH: palette.sand,
  SH: palette.peach,
};

export function ProtocolLayersScene({ params, step, reduce }: SceneProps<ProtocolLayersParams>) {
  const layers = layersOf(params.model);
  const n = layers.length;
  const rowH = n > 4 ? 24 : 34;
  const headerW = n > 4 ? 15 : 18;
  const dataW = 38;
  const trailerW = 10;
  const unitH = rowH - 10;
  const stackH = n * rowH + (n - 1) * GAP;
  const wireY = TOP + stackH + 22;
  const height = wireY + 26;

  const pos = positionAt(params.model, step);
  const headers = headersAt(params.model, step); // innermost first
  const hasTrailer = headers.some((h) => h.trailer);
  const rowY = (i: number) => TOP + i * (rowH + GAP);
  const unitW = headers.length * headerW + dataW + (hasTrailer ? trailerW : 0);

  // Where the data unit sits: in a sender row (right part), on the wire, or in a receiver row (left part).
  const unitX = pos.side === "sender" ? SENDER_X + STACK_W - 8 - unitW : pos.side === "wire" ? (SENDER_X + STACK_W + RECEIVER_X) / 2 - unitW / 2 : RECEIVER_X + 8;
  const unitY = pos.side === "wire" ? wireY - unitH / 2 : rowY(pos.layer) + 5;

  const allHeaders = layers.filter((l) => l.header !== null);
  const unitName = (() => {
    const last = headers[headers.length - 1];
    if (!last) return "data";
    if (last.trailer) return "frame";
    if (/^(IP|NH)$/.test(last.header ?? "")) return "packet";
    if (/^(TCP|TH)$/.test(last.header ?? "")) return "segment";
    return "data";
  })();

  return (
    <svg {...svgProps} viewBox={`0 0 520 ${height}`} fontSize={10}>
      <defs>
        <marker id="pl-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill={palette.line} />
        </marker>
      </defs>

      {/* the two stacks */}
      {[
        { x: SENDER_X, side: "sender" as const, label: "Sender" },
        { x: RECEIVER_X, side: "receiver" as const, label: "Receiver" },
      ].map((stack) => (
        <g key={stack.side}>
          <text x={stack.x + STACK_W / 2} y={TOP - 7} textAnchor="middle" fill={palette.muted} fontSize={9}>
            {stack.label}
          </text>
          {layers.map((layer, i) => {
            const active = pos.side === stack.side && pos.layer === i;
            return (
              <g key={layer.name}>
                <motion.rect
                  x={stack.x}
                  y={rowY(i)}
                  width={STACK_W}
                  height={rowH}
                  rx="9"
                  initial={false}
                  animate={{ fill: active ? palette.peach : palette.white, stroke: active ? palette.coral : palette.lineSoft }}
                  transition={fade(reduce)}
                  strokeWidth="1.5"
                />
                <text
                  x={stack.side === "sender" ? stack.x + 10 : stack.x + STACK_W - 10}
                  y={rowY(i) + rowH / 2 + 3.5}
                  textAnchor={stack.side === "sender" ? "start" : "end"}
                  fill={palette.ink}
                  fontWeight={800}
                >
                  {layer.name}
                </text>
              </g>
            );
          })}
        </g>
      ))}

      {/* direction arrows */}
      <line x1={SENDER_X + STACK_W + 12} y1={TOP + 4} x2={SENDER_X + STACK_W + 12} y2={TOP + stackH - 4} stroke={palette.line} strokeWidth="1.5" markerEnd="url(#pl-arrow)" />
      <line x1={RECEIVER_X - 12} y1={TOP + stackH - 4} x2={RECEIVER_X - 12} y2={TOP + 4} stroke={palette.line} strokeWidth="1.5" markerEnd="url(#pl-arrow)" />

      {/* the wire */}
      <line x1={SENDER_X + 20} y1={wireY} x2={RECEIVER_X + STACK_W - 20} y2={wireY} stroke={palette.line} strokeWidth="2" strokeDasharray="5 4" />
      <motion.text
        x={(SENDER_X + STACK_W + RECEIVER_X) / 2}
        y={wireY + 20}
        textAnchor="middle"
        fill={palette.muted}
        fontSize={9}
        initial={false}
        animate={{ opacity: pos.side === "wire" ? 1 : 0 }}
        transition={fade(reduce)}
      >
        1011 0010 1110 0001 ... bits on the link
      </motion.text>

      {/* the data unit, wrapped in the headers present at this step */}
      <motion.g initial={false} animate={{ x: unitX, y: unitY }} transition={move(reduce)}>
        {/* headers, outermost on the left */}
        {allHeaders.map((layer) => {
          const index = headers.indexOf(layer);
          const present = index >= 0;
          const slotIndex = present ? headers.length - 1 - index : 0;
          return (
            <motion.g key={layer.header} initial={false} animate={{ x: slotIndex * headerW, opacity: present ? 1 : 0 }} transition={move(reduce)}>
              <rect width={headerW} height={unitH} rx="4" fill={headerFill[layer.header ?? ""] ?? palette.sky} stroke={palette.line} strokeWidth="1" />
              <text x={headerW / 2} y={unitH / 2 + 3} textAnchor="middle" fill={palette.ink} fontSize={n > 4 ? 7 : 8}>
                {layer.header}
              </text>
            </motion.g>
          );
        })}
        {/* the data itself */}
        <motion.g initial={false} animate={{ x: headers.length * headerW }} transition={move(reduce)}>
          <rect width={dataW} height={unitH} rx="4" fill={palette.peach} stroke={palette.coral} strokeWidth="1.5" />
          <text x={dataW / 2} y={unitH / 2 + 3} textAnchor="middle" fill={palette.ink} fontSize={8}>
            data
          </text>
        </motion.g>
        {/* the frame trailer */}
        <motion.g initial={false} animate={{ x: headers.length * headerW + dataW, opacity: hasTrailer ? 1 : 0 }} transition={move(reduce)}>
          <rect width={trailerW} height={unitH} rx="3" fill={palette.mint} stroke={palette.line} strokeWidth="1" />
        </motion.g>
        <text x={unitW / 2} y={unitH + 10} textAnchor="middle" fill={palette.coralDark} fontSize={8}>
          {unitName}
        </text>
      </motion.g>
    </svg>
  );
}
