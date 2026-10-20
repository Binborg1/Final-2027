import type { IllustrationId } from "@/lib/types";

/** What each still illustration shows, for its caption and for the tutor's description of the screen. */
export const illustrationCaptions: Record<IllustrationId, string> = {
  packets: "One message becomes several packets, each with its own header.",
  routes: "Routers forward each packet hop by hop; packets can take different routes.",
  handshake: "Three messages open a TCP connection before any data is sent.",
  layers: "Data passes down the layers to send and back up to receive.",
};
