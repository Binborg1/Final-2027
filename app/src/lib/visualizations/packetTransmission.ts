import { clampInt, type PacketTransmissionParams, type VisualizationCheckpoint, type VisualizationDefinition, type VisualizationStep } from "./types";

export const PACKET_LIMITS = { min: 2, max: 8 } as const;

export function normalizePacketTransmission(raw: Record<string, unknown>): PacketTransmissionParams {
  const packets = clampInt(raw.packets, PACKET_LIMITS.min, PACKET_LIMITS.max, 4);
  const lost = raw.lostPacket;
  const none = lost === null || lost === undefined || lost === "none" || lost === 0;
  const lostPacket = none ? null : clampInt(lost, 1, packets, 0) || null;
  return { packets, lostPacket };
}

/** Odd-numbered packets take the top route, even-numbered the bottom one. */
export function routeOf(packetNumber: number): "top" | "bottom" {
  return packetNumber % 2 === 1 ? "top" : "bottom";
}

/** The order packets reach the receiver: the shorter top route delivers first, then the bottom one. */
export function arrivalOrder({ packets, lostPacket }: PacketTransmissionParams): number[] {
  const all = Array.from({ length: packets }, (_, i) => i + 1).filter((n) => n !== lostPacket);
  return [...all.filter((n) => routeOf(n) === "top"), ...all.filter((n) => routeOf(n) === "bottom")];
}

export function packetSteps({ packets, lostPacket }: PacketTransmissionParams): VisualizationStep[] {
  const steps: VisualizationStep[] = [
    { id: "message", caption: "Your message sits at the sender as one block of data. It is too big to send in one go." },
    {
      id: "split",
      caption: `The sender splits it into ${packets} packets. Each one gets a header: its sequence number, plus the source and destination addresses.`,
    },
    { id: "travel", caption: "Each packet travels on its own. Routers forward them hop by hop, and packets can take different routes.", hold: 3200 },
  ];
  if (lostPacket !== null) {
    steps.push({ id: "loss", caption: `Packet ${lostPacket} is dropped on a congested link. The others keep going.` });
    steps.push({
      id: "arrive",
      caption: `The other packets arrive, not in the order they were sent. The receiver reads the sequence numbers and spots the gap: packet ${lostPacket} is missing.`,
      hold: 3600,
    });
    steps.push({
      id: "resend",
      caption: `The receiver asks for packet ${lostPacket} again. The sender resends just that one packet, not the whole message.`,
      hold: 3200,
    });
  } else {
    steps.push({
      id: "arrive",
      caption: "The packets arrive, not necessarily in the order they were sent. Each one still carries its sequence number.",
      hold: 3200,
    });
  }
  steps.push({ id: "rebuild", caption: "The receiver puts the packets back in order by sequence number and rebuilds the original message." });
  return steps;
}

export function packetCheckpoints(params: PacketTransmissionParams): VisualizationCheckpoint[] {
  const beforeStep = packetSteps(params).findIndex((s) => s.id === "arrive");
  if (params.lostPacket !== null) {
    const n = params.lostPacket;
    return [
      {
        beforeStep,
        prompt: `Packet ${n} never arrives. What will the receiver do?`,
        options: [
          { id: "a", text: "Throw the whole message away and ask the sender to start again from packet 1." },
          { id: "b", text: `Notice the gap from the sequence numbers and ask for just packet ${n}.` },
          { id: "c", text: "Hand the application the message with a hole where the packet should be." },
        ],
        correctId: "b",
        whenRight: `Exactly. The sequence numbers make the gap obvious, so only packet ${n} needs to be sent again.`,
        whenWrong: "Not quite. Every packet carries a sequence number, so the receiver can see exactly which one is missing and ask for only that one.",
      },
    ];
  }
  return [
    {
      beforeStep,
      prompt: "The packets took different routes. Will they arrive in the order they were sent?",
      options: [
        { id: "a", text: "Always. The network keeps packets in order." },
        { id: "b", text: "Not necessarily. The receiver uses the sequence numbers to put them back in order." },
        { id: "c", text: "They arrive in reverse order, last packet first." },
      ],
      correctId: "b",
      whenRight: "Right. Different routes mean different delays, so the order can change, and the sequence numbers fix it at the end.",
      whenWrong: "Not quite. Packets on a faster route overtake the others, so they can arrive out of order. The sequence numbers let the receiver sort them.",
    },
  ];
}

export const packetTransmission: VisualizationDefinition<PacketTransmissionParams> = {
  type: "packet-transmission",
  family: "specialized",
  title: "Packet transmission",
  summary:
    "A message is split into numbered packets that travel across a network by different routes, can be lost or arrive out of order, and are put back together at the receiver.",
  useWhen: "a message being split into packets, packets taking different routes, packet loss and retransmission, or reassembly by sequence number",
  schemaDoc: `"packets": integer ${PACKET_LIMITS.min} to ${PACKET_LIMITS.max}; "lostPacket": integer from 1 to packets for a dropped packet, or null for a clean delivery`,
  defaults: { packets: 4, lostPacket: null },
  controls: (p) => [
    { kind: "range", key: "packets", label: "Packets", min: PACKET_LIMITS.min, max: PACKET_LIMITS.max, step: 1 },
    {
      kind: "select",
      key: "lostPacket",
      label: "Lose a packet",
      options: [{ value: "none", label: "None" }, ...Array.from({ length: p.packets }, (_, i) => ({ value: String(i + 1), label: `Packet ${i + 1}` }))],
    },
  ],
  applyControl: (p, key, value) => normalizePacketTransmission({ ...p, [key]: value }),
  normalize: normalizePacketTransmission,
  steps: packetSteps,
  checkpoints: packetCheckpoints,
  describe: () => ({ title: packetTransmission.title, summary: packetTransmission.summary }),
};
