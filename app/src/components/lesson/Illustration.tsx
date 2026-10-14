import type { IllustrationId } from "@/lib/types";

const ink = "#252525";
const muted = "#6b645c";
const line = "#cdbfae";
const coral = "#ff8055";
const peach = "#ffe3d3";

export function Illustration({ id }: { id: IllustrationId }) {
  const { Picture, caption } = pictures[id];
  return (
    <figure className="rounded-2xl border border-line bg-sand p-4">
      <Picture />
      <figcaption className="mt-2 text-center text-xs font-semibold text-smoke">{caption}</figcaption>
    </figure>
  );
}

const svgProps = {
  className: "mx-auto h-auto w-full max-w-xl",
  fontFamily: "inherit",
  fontSize: 11,
  fontWeight: 600,
  role: "img" as const,
};

function Arrow({ id }: { id: string }) {
  return (
    <defs>
      <marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0 0L10 5L0 10z" fill={line} />
      </marker>
    </defs>
  );
}

function Packets() {
  return (
    <svg {...svgProps} viewBox="0 0 520 124" aria-label="A message split into three packets travelling from a computer to a server">
      <Arrow id="packets-arrow" />
      <rect x="16" y="28" width="96" height="60" rx="12" fill="#fff" stroke={line} strokeWidth="1.5" />
      <rect x="32" y="40" width="64" height="32" rx="6" fill="#fff" stroke={line} strokeWidth="1.5" />
      <text x="64" y="112" textAnchor="middle" fill={ink}>Your computer</text>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={160 + i * 86} y="40" width="66" height="36" rx="10" fill={peach} stroke={coral} strokeWidth="1.5" />
          <text x={193 + i * 86} y="62" textAnchor="middle" fill={ink}>{`Packet ${i + 1}`}</text>
        </g>
      ))}
      <line x1="112" y1="58" x2="156" y2="58" stroke={line} strokeWidth="1.5" strokeDasharray="4 3" markerEnd="url(#packets-arrow)" />
      <line x1="226" y1="58" x2="242" y2="58" stroke={line} strokeWidth="1.5" strokeDasharray="4 3" />
      <line x1="312" y1="58" x2="328" y2="58" stroke={line} strokeWidth="1.5" strokeDasharray="4 3" />
      <line x1="398" y1="58" x2="410" y2="58" stroke={line} strokeWidth="1.5" strokeDasharray="4 3" markerEnd="url(#packets-arrow)" />
      <rect x="414" y="20" width="90" height="76" rx="12" fill="#fff" stroke={line} strokeWidth="1.5" />
      <line x1="428" y1="40" x2="490" y2="40" stroke={line} strokeWidth="1.5" />
      <line x1="428" y1="58" x2="490" y2="58" stroke={line} strokeWidth="1.5" />
      <line x1="428" y1="76" x2="490" y2="76" stroke={line} strokeWidth="1.5" />
      <text x="459" y="112" textAnchor="middle" fill={ink}>Website server</text>
    </svg>
  );
}

function Routes() {
  return (
    <svg {...svgProps} viewBox="0 0 520 150" aria-label="Packets from one message taking two different routes through routers">
      <Arrow id="routes-arrow" />
      <polyline points="62,75 180,30 340,30 456,75" fill="none" stroke={line} strokeWidth="1.5" markerEnd="url(#routes-arrow)" />
      <polyline points="62,75 260,122 456,75" fill="none" stroke={line} strokeWidth="1.5" markerEnd="url(#routes-arrow)" />
      <circle cx="40" cy="75" r="22" fill="#fff" stroke={line} strokeWidth="1.5" />
      <text x="40" y="79" textAnchor="middle" fill={ink}>You</text>
      <circle cx="480" cy="75" r="22" fill="#fff" stroke={line} strokeWidth="1.5" />
      <text x="480" y="79" textAnchor="middle" fill={ink}>Website</text>
      {[
        [180, 30, "R1"],
        [340, 30, "R2"],
        [260, 122, "R3"],
      ].map(([x, y, label]) => (
        <g key={label}>
          <circle cx={x} cy={y} r="15" fill="#fff" stroke={line} strokeWidth="1.5" />
          <text x={x} y={Number(y) + 4} textAnchor="middle" fill={ink}>{label}</text>
        </g>
      ))}
      <rect x="104" y="48" width="12" height="12" rx="3" fill={coral} />
      <text x="110" y="42" textAnchor="middle" fill={ink}>Packet 1</text>
      <rect x="392" y="46" width="12" height="12" rx="3" fill={coral} />
      <text x="398" y="40" textAnchor="middle" fill={ink}>Packet 3</text>
      <rect x="150" y="92" width="12" height="12" rx="3" fill={coral} />
      <text x="156" y="120" textAnchor="middle" fill={ink}>Packet 2</text>
    </svg>
  );
}

function Handshake() {
  return (
    <svg {...svgProps} viewBox="0 0 520 150" aria-label="The three messages of a TCP handshake between a client and a server">
      <Arrow id="handshake-arrow" />
      <text x="120" y="22" textAnchor="middle" fontWeight="800" fill={ink}>Client</text>
      <text x="400" y="22" textAnchor="middle" fontWeight="800" fill={ink}>Server</text>
      <line x1="120" y1="32" x2="120" y2="140" stroke={line} strokeWidth="1.5" />
      <line x1="400" y1="32" x2="400" y2="140" stroke={line} strokeWidth="1.5" />
      <line x1="122" y1="56" x2="396" y2="56" stroke={coral} strokeWidth="2" markerEnd="url(#handshake-arrow)" />
      <text x="260" y="50" textAnchor="middle" fill={ink}>1. SYN</text>
      <line x1="398" y1="90" x2="124" y2="90" stroke={coral} strokeWidth="2" markerEnd="url(#handshake-arrow)" />
      <text x="260" y="84" textAnchor="middle" fill={ink}>2. SYN-ACK</text>
      <line x1="122" y1="124" x2="396" y2="124" stroke={coral} strokeWidth="2" markerEnd="url(#handshake-arrow)" />
      <text x="260" y="118" textAnchor="middle" fill={ink}>3. ACK</text>
    </svg>
  );
}

function Layers() {
  const rows = [
    ["Application", "HTTP, email, the program you use"],
    ["Transport", "TCP or UDP, ports"],
    ["Internet", "IP addresses, routing between networks"],
    ["Link", "Wi-Fi, Ethernet, the physical connection"],
  ];
  return (
    <svg {...svgProps} viewBox="0 0 520 176" aria-label="The four TCP/IP layers stacked from Application at the top to Link at the bottom">
      <Arrow id="layers-arrow" />
      {rows.map(([name, detail], i) => (
        <g key={name}>
          <rect
            x="110"
            y={10 + i * 40}
            width="300"
            height="32"
            rx="10"
            fill={i === 2 ? peach : "#fff"}
            stroke={i === 2 ? coral : line}
            strokeWidth="1.5"
          />
          <text x="124" y={30 + i * 40} fontWeight="800" fill={ink}>{name}</text>
          <text x="400" y={30 + i * 40} textAnchor="end" fill={muted}>{detail}</text>
        </g>
      ))}
      <line x1="70" y1="14" x2="70" y2="166" stroke={line} strokeWidth="1.5" markerEnd="url(#layers-arrow)" />
      <text x="70" y="176" textAnchor="middle" fill={muted}>send</text>
      <line x1="450" y1="166" x2="450" y2="14" stroke={line} strokeWidth="1.5" markerEnd="url(#layers-arrow)" />
      <text x="450" y="176" textAnchor="middle" fill={muted}>receive</text>
    </svg>
  );
}

const pictures: Record<IllustrationId, { Picture: () => React.ReactElement; caption: string }> = {
  packets: { Picture: Packets, caption: "One message becomes several packets, each with its own header." },
  routes: { Picture: Routes, caption: "Routers forward each packet hop by hop; packets can take different routes." },
  handshake: { Picture: Handshake, caption: "Three messages open a TCP connection before any data is sent." },
  layers: { Picture: Layers, caption: "Data passes down the layers to send and back up to receive." },
};
