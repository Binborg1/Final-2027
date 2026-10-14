"use client";

import { motion } from "framer-motion";
import { layoutAt, PACKET, RECEIVER, ROUTERS, ROUTES, SENDER } from "@/lib/visualizations/packetLayout";
import type { PacketTransmissionParams } from "@/lib/visualizations/types";
import { fade, move, palette, svgProps, type SceneProps } from "./shared";

export function PacketTransmissionScene({ params, step, reduce }: SceneProps<PacketTransmissionParams>) {
  const layout = layoutAt(params, step);
  const { lostPacket } = params;
  const outlineCols = params.packets > 4 ? 2 : 1;
  const outlineRows = Math.min(params.packets, 4);

  return (
    <svg {...svgProps} viewBox="0 0 520 184" fontSize={10}>
      <defs>
        <marker id="pt-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill={palette.line} />
        </marker>
      </defs>

      {/* routes */}
      <polyline points={ROUTES.top.map((p) => p.join(",")).join(" ")} fill="none" stroke={palette.line} strokeWidth="1.5" strokeDasharray="4 3" />
      <polyline points={ROUTES.bottom.map((p) => p.join(",")).join(" ")} fill="none" stroke={palette.line} strokeWidth="1.5" strokeDasharray="4 3" />
      {ROUTERS.map((r) => (
        <g key={r.label}>
          <circle cx={r.x} cy={r.y} r="13" fill={palette.sky} stroke={palette.skyDark} strokeWidth="1.5" />
          <text x={r.x} y={r.y + 3.5} textAnchor="middle" fill={palette.skyDark} fontSize={9}>
            {r.label}
          </text>
        </g>
      ))}

      {/* sender and receiver */}
      <rect x={SENDER.x} y={SENDER.y} width={SENDER.w} height={SENDER.h} rx="14" fill={palette.white} stroke={palette.line} strokeWidth="1.5" />
      <text x={SENDER.x + SENDER.w / 2} y={SENDER.y + SENDER.h + 16} textAnchor="middle" fill={palette.ink}>
        Sender
      </text>
      <rect x={RECEIVER.x} y={RECEIVER.y} width={RECEIVER.w} height={RECEIVER.h} rx="14" fill={palette.white} stroke={palette.line} strokeWidth="1.5" />
      <text x={RECEIVER.x + RECEIVER.w / 2} y={RECEIVER.y + RECEIVER.h + 16} textAnchor="middle" fill={palette.ink}>
        Receiver
      </text>

      {/* the whole message, before it is split */}
      <motion.g initial={false} animate={{ opacity: layout.senderBlock }} transition={fade(reduce)}>
        <rect x={SENDER.x + 14} y={SENDER.y + 16} width={SENDER.w - 28} height={SENDER.h - 32} rx="8" fill={palette.peach} stroke={palette.coral} strokeWidth="1.5" />
        <text x={SENDER.x + SENDER.w / 2} y={SENDER.y + SENDER.h / 2 + 4} textAnchor="middle" fill={palette.ink}>
          Message
        </text>
      </motion.g>

      {/* the message, rebuilt */}
      <motion.g initial={false} animate={{ opacity: layout.receiverOutline }} transition={fade(reduce)}>
        <rect
          x={RECEIVER.x + 6}
          y={RECEIVER.y + 6}
          width={outlineCols * 36 + 2}
          height={outlineRows * 19 + 5}
          rx="8"
          fill="none"
          stroke={palette.mintDark}
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
        <text x={RECEIVER.x + RECEIVER.w - 8} y={RECEIVER.y + RECEIVER.h - 8} textAnchor="end" fill={palette.mintDark} fontSize={9}>
          in order
        </text>
      </motion.g>

      {/* the request to resend */}
      <motion.g initial={false} animate={{ opacity: layout.resendArrow ? 1 : 0 }} transition={fade(reduce)}>
        <line x1={RECEIVER.x - 4} y1={120} x2={SENDER.x + SENDER.w + 6} y2={120} stroke={palette.coralDark} strokeWidth="1.5" strokeDasharray="3 3" markerEnd="url(#pt-arrow)" />
        <text x={260} y={134} textAnchor="middle" fill={palette.coralDark} fontSize={9}>
          {`send packet ${lostPacket ?? ""} again`}
        </text>
      </motion.g>

      {/* packets */}
      {layout.packets.map((pose, i) => (
        <motion.g key={i + 1} initial={false} animate={{ x: pose.x, y: pose.y, opacity: pose.opacity }} transition={move(reduce)}>
          <rect width={PACKET.w} height={PACKET.h} rx="5" fill={pose.dim ? palette.sand : palette.peach} stroke={palette.coral} strokeWidth="1.5" />
          <text x={PACKET.w / 2} y={PACKET.h / 2 + 3.5} textAnchor="middle" fill={palette.ink} fontSize={9}>
            {i + 1}
          </text>
        </motion.g>
      ))}

      {/* the loss */}
      <motion.g
        initial={false}
        animate={{ opacity: layout.lossMark ? 1 : 0, x: layout.lossMark?.[0] ?? 260, y: layout.lossMark?.[1] ?? 100 }}
        transition={fade(reduce)}
      >
        <circle r="11" fill={palette.blush} stroke={palette.peachDark} strokeWidth="1.5" />
        <path d="M-4 -4L4 4M4 -4L-4 4" stroke={palette.peachDark} strokeWidth="2" strokeLinecap="round" />
      </motion.g>
    </svg>
  );
}
