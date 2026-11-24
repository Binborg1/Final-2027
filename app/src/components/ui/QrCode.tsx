import "server-only";
import { qrPath } from "@/lib/ui/qr";
import { cn } from "@/lib/ui/cn";

/** A QR code for a link, drawn on the server: dark modules on white, with its quiet zone. Used by the Live lobby (and the course page later). */
export function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const { size, d } = qrPath(value);
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" className={cn("block rounded-tile bg-white", className)}>
      <rect width={size} height={size} fill="#ffffff" />
      <path d={d} fill="#241b14" />
    </svg>
  );
}
