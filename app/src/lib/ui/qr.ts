import QRCode from "qrcode";

/**
 * A QR code as one SVG path, drawn on the server (no JavaScript reaches the
 * browser for it). Medium error correction survives a dusty projector screen; the
 * 4-module quiet zone around it is what phone cameras need to find the code.
 */

export const QUIET_ZONE = 4;

export function qrPath(value: string): { size: number; d: string } {
  const { modules } = QRCode.create(value, { errorCorrectionLevel: "M" });
  const n = modules.size;
  const parts: string[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; ) {
      if (!modules.get(r, c)) {
        c++;
        continue;
      }
      let run = 1;
      while (c + run < n && modules.get(r, c + run)) run++;
      parts.push(`M${c + QUIET_ZONE} ${r + QUIET_ZONE}h${run}v1h-${run}z`);
      c += run;
    }
  }
  return { size: n + QUIET_ZONE * 2, d: parts.join("") };
}
