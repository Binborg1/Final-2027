import { arrivalOrder, packetSteps, routeOf } from "./packetTransmission";
import type { PacketTransmissionParams } from "./types";

/* Geometry of the packet scene: sender on the left, receiver on the right, two routes between them. */
export const SENDER = { x: 14, y: 58, w: 96, h: 84 } as const;
export const RECEIVER = { x: 410, y: 58, w: 96, h: 84 } as const;
export const ROUTES = {
  top: [
    [110, 100],
    [190, 40],
    [330, 40],
    [410, 100],
  ],
  bottom: [
    [110, 100],
    [260, 160],
    [410, 100],
  ],
} as const;
export const ROUTERS = [
  { x: 190, y: 40, label: "R1" },
  { x: 330, y: 40, label: "R2" },
  { x: 260, y: 160, label: "R3" },
] as const;
export const PACKET = { w: 30, h: 16 } as const;

export type Point = readonly [number, number];

/** The point a fraction `t` (0 to 1) of the way along a polyline, by distance. */
export function pointAt(points: readonly Point[], t: number): Point {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
  const total = lengths.reduce((a, b) => a + b, 0);
  let remaining = Math.min(1, Math.max(0, t)) * total;
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i] || i === lengths.length - 1) {
      const f = lengths[i] === 0 ? 0 : remaining / lengths[i];
      return [points[i][0] + (points[i + 1][0] - points[i][0]) * f, points[i][1] + (points[i + 1][1] - points[i][1]) * f];
    }
    remaining -= lengths[i];
  }
  return points[points.length - 1];
}

/** Slot `index` (0-based) inside a box: two columns of four. */
export function slot(box: { x: number; y: number }, index: number): Point {
  const col = Math.floor(index / 4);
  const row = index % 4;
  return [box.x + 10 + col * 36, box.y + 10 + row * 19];
}

export type PacketPose = { x: number; y: number; opacity: number; dim: boolean };

export type PacketLayout = {
  /** One pose per packet, in packet order. */
  packets: PacketPose[];
  /** Opacity of the unsplit message at the sender. */
  senderBlock: number;
  /** Opacity of the "rebuilt message" outline at the receiver. */
  receiverOutline: number;
  /** Where to draw the dropped-packet mark, if any. */
  lossMark: Point | null;
  resendArrow: boolean;
};

/** Where everything is at a step. Pure, so it can be checked without rendering. */
export function layoutAt(params: PacketTransmissionParams, step: number): PacketLayout {
  const { packets: n, lostPacket } = params;
  const steps = packetSteps(params);
  const stepId = steps[Math.min(Math.max(step, 0), steps.length - 1)]?.id ?? "message";
  const numbers = Array.from({ length: n }, (_, i) => i + 1);
  const onRoute = (route: "top" | "bottom", exclude: number | null) => numbers.filter((p) => routeOf(p) === route && p !== exclude);
  /** Packets sharing a route are spread out behind the leader, lower-numbered packets ahead. */
  const spread = (p: number, exclude: number | null, lead: number, span: number) => {
    const peers = onRoute(routeOf(p), exclude);
    const rank = peers.indexOf(p);
    return lead - rank * (span / Math.max(peers.length - 1, 1));
  };
  const atSender = (p: number): Point => slot(SENDER, p - 1);
  const alongRoute = (p: number, t: number): Point => {
    const [x, y] = pointAt(ROUTES[routeOf(p)], t);
    return [x - PACKET.w / 2, y - PACKET.h / 2];
  };
  const pose = ([x, y]: Point, opacity = 1, dim = false): PacketPose => ({ x, y, opacity, dim });
  const still = { senderBlock: 0, receiverOutline: 0, lossMark: null, resendArrow: false };

  switch (stepId) {
    case "message":
      return { ...still, packets: numbers.map((p) => pose(atSender(p), 0)), senderBlock: 1 };
    case "split":
      return { ...still, packets: numbers.map((p) => pose(atSender(p))) };
    case "travel":
      return { ...still, packets: numbers.map((p) => pose(alongRoute(p, spread(p, null, 0.7, 0.5)))) };
    case "loss": {
      const lost = lostPacket ?? 0;
      const lostAt = alongRoute(lost, 0.5);
      return {
        ...still,
        packets: numbers.map((p) => (p === lost ? pose(lostAt, 0.35, true) : pose(alongRoute(p, spread(p, lost, 0.92, 0.4))))),
        lossMark: [lostAt[0] + PACKET.w / 2, lostAt[1] + PACKET.h / 2],
      };
    }
    case "arrive": {
      const order = arrivalOrder(params);
      return { ...still, packets: numbers.map((p) => (p === lostPacket ? pose(alongRoute(p, 0.5), 0) : pose(slot(RECEIVER, order.indexOf(p))))) };
    }
    case "resend": {
      const order = arrivalOrder(params);
      return {
        ...still,
        packets: numbers.map((p) => (p === lostPacket ? pose(alongRoute(p, 0.75)) : pose(slot(RECEIVER, order.indexOf(p))))),
        resendArrow: true,
      };
    }
    default:
      return { ...still, packets: numbers.map((p) => pose(slot(RECEIVER, p - 1))), receiverOutline: 1 };
  }
}
