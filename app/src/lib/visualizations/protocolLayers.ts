import { oneOf, type ProtocolLayersParams, type VisualizationCheckpoint, type VisualizationDefinition, type VisualizationStep } from "./types";

export type Layer = {
  name: string;
  /** Label on the header block, or null when the layer adds no header. */
  header: string | null;
  /** The layer also adds a trailer (the frame check at the link layer). */
  trailer?: boolean;
  /** Caption while sending (going down the stack). */
  down: string;
  /** Caption while receiving (coming back up). */
  up: string;
};

const TCP_IP: Layer[] = [
  {
    name: "Application",
    header: null,
    down: "The application creates the data: here, an HTTP request for a web page.",
    up: "The application receives the data exactly as it was sent. Each layer only ever touched its own header.",
  },
  {
    name: "Transport",
    header: "TCP",
    down: "Transport (TCP) adds its header in front: port numbers and a sequence number. The unit is now a segment.",
    up: "Transport removes the TCP header, checks the sequence number and hands the data to the right port.",
  },
  {
    name: "Internet",
    header: "IP",
    down: "Internet (IP) adds its header: the source and destination IP addresses. Now it is a packet.",
    up: "Internet checks that the destination address is this host and removes the IP header.",
  },
  {
    name: "Link",
    header: "ETH",
    trailer: true,
    down: "Link (Ethernet or Wi-Fi) adds a frame header with hardware addresses and a trailer with a checksum. Now it is a frame.",
    up: "Link checks the frame against the trailer, then removes its header and trailer.",
  },
];

const OSI: Layer[] = [
  { name: "Application", header: null, down: "The application creates the data to send.", up: "The application receives the data exactly as it was sent." },
  {
    name: "Presentation",
    header: "PH",
    down: "Presentation adds its header: how the data is encoded, compressed or encrypted.",
    up: "Presentation removes its header and decodes the data into the form the application expects.",
  },
  {
    name: "Session",
    header: "SH",
    down: "Session adds its header to manage the dialogue between the two ends.",
    up: "Session removes its header and matches the data to the right dialogue.",
  },
  {
    name: "Transport",
    header: "TH",
    down: "Transport adds its header: ports and sequence numbers. The unit is a segment.",
    up: "Transport removes its header, checks the sequence number and delivers to the right port.",
  },
  {
    name: "Network",
    header: "NH",
    down: "Network adds its header: logical addresses used for routing. The unit is a packet.",
    up: "Network checks that the address is this host and removes its header.",
  },
  {
    name: "Data Link",
    header: "DH",
    trailer: true,
    down: "Data Link adds a frame header with hardware addresses and a trailer with a checksum. The unit is a frame.",
    up: "Data Link checks the frame against the trailer, then removes its header and trailer.",
  },
  {
    name: "Physical",
    header: null,
    down: "Physical turns the frame into signals on the medium: electrical, light or radio.",
    up: "Physical on the receiving side turns the signals back into the bits of the frame.",
  },
];

export function layersOf(model: ProtocolLayersParams["model"]): Layer[] {
  return model === "osi" ? OSI : TCP_IP;
}

export function normalizeProtocolLayers(raw: Record<string, unknown>): ProtocolLayersParams {
  return { model: oneOf(raw.model, ["tcp-ip", "osi"] as const, "tcp-ip") };
}

/** Where the data unit is at a step: in a layer of the sender, on the wire, or in a layer of the receiver. */
export type LayerPosition = { side: "sender" | "receiver" | "wire"; layer: number };

export function positionAt(model: ProtocolLayersParams["model"], step: number): LayerPosition {
  const n = layersOf(model).length;
  if (step < n) return { side: "sender", layer: step };
  if (step === n) return { side: "wire", layer: n - 1 };
  return { side: "receiver", layer: n - 1 - (step - n - 1) };
}

/** Which headers are wrapped around the data at a step, innermost first. */
export function headersAt(model: ProtocolLayersParams["model"], step: number): Layer[] {
  const layers = layersOf(model);
  const pos = positionAt(model, step);
  const depth = pos.side === "sender" ? pos.layer : pos.side === "wire" ? layers.length - 1 : pos.layer - 1;
  return layers.slice(0, depth + 1).filter((l) => l.header !== null);
}

export function layerSteps({ model }: ProtocolLayersParams): VisualizationStep[] {
  const layers = layersOf(model);
  const down = layers.map((l, i) => ({ id: `down-${i}`, caption: l.down }));
  const wire = { id: "wire", caption: "The bits of the frame cross the physical link to the next device.", hold: 2600 };
  const up = [...layers].reverse().map((l, i) => ({ id: `up-${layers.length - 1 - i}`, caption: l.up }));
  return [...down, wire, ...up];
}

export function layerCheckpoints({ model }: ProtocolLayersParams): VisualizationCheckpoint[] {
  const layers = layersOf(model);
  const withHeader = layers.filter((l) => l.header !== null);
  const first = withHeader[0];
  const last = withHeader[withHeader.length - 1];
  return [
    {
      beforeStep: layers.length + 1,
      prompt: "The frame has arrived at the receiver. In what order are the headers removed?",
      options: [
        { id: "a", text: `Top down: the first header added (${first.name}) is removed first.` },
        { id: "b", text: `Bottom up: the last header added (${last.name}) is removed first, then the stack is unwrapped in reverse.` },
        { id: "c", text: "All at once, by the application." },
      ],
      correctId: "b",
      whenRight: "Exactly. Each layer unwraps only its own header, so the header added last is the first one removed.",
      whenWrong: `Not quite. Unwrapping mirrors wrapping: the header added last, by ${last.name}, is removed first, and the receiver works back up the stack.`,
    },
  ];
}

export const protocolLayers: VisualizationDefinition<ProtocolLayersParams> = {
  type: "protocol-layers",
  family: "specialized",
  title: "Protocol layers",
  summary:
    "Data passes down the sender's protocol stack, each layer adding its own header, crosses the link, and climbs the receiver's stack while the headers are removed in reverse order.",
  useWhen: "the TCP/IP or OSI layer models, encapsulation, headers added by each layer, or how a request moves down and back up the stack",
  schemaDoc: `"model": "tcp-ip" (four layers) or "osi" (seven layers)`,
  defaults: { model: "tcp-ip" },
  controls: () => [
    {
      kind: "select",
      key: "model",
      label: "Model",
      options: [
        { value: "tcp-ip", label: "TCP/IP (4 layers)" },
        { value: "osi", label: "OSI (7 layers)" },
      ],
    },
  ],
  applyControl: (p, key, value) => normalizeProtocolLayers({ ...p, [key]: value }),
  normalize: normalizeProtocolLayers,
  steps: layerSteps,
  checkpoints: layerCheckpoints,
  describe: () => ({ title: protocolLayers.title, summary: protocolLayers.summary }),
};
