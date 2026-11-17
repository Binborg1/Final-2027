"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Optional, student-initiated screen sharing through the browser's Screen
 * Capture API. The stream is only ever drawn to a hidden video element in
 * this tab; nothing is recorded, uploaded or stored. A single still frame is
 * taken only when `capture()` is called, which the UI does on an explicit
 * "Analyze current screen" action, and the frame is handed back as a data URL
 * for the student to review before anything leaves the device.
 */
export type ScreenShareStatus = "unsupported" | "idle" | "requesting" | "sharing";

export type ScreenShare = {
  status: ScreenShareStatus;
  /** What is being shared, in the browser's words ("a browser tab", "a window", "your whole screen"). */
  label: string | null;
  /** The last problem (permission refused, nothing picked), or a notice that sharing ended. */
  notice: string | null;
  start: () => Promise<void>;
  stop: () => void;
  /** One frame of the shared surface as a JPEG data URL, at most 1280 pixels wide, or null when nothing is shared. */
  capture: () => Promise<string | null>;
  /** Shows the live stream in a small preview element (the sharing indicator). */
  attachPreview: (element: HTMLVideoElement | null) => void;
};

const noop = () => () => {};
const isSupported = () => typeof navigator !== "undefined" && !!navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === "function";

function describeSurface(track: MediaStreamTrack): string {
  const surface = (track.getSettings() as MediaTrackSettings & { displaySurface?: string }).displaySurface;
  switch (surface) {
    case "browser":
      return "a browser tab";
    case "window":
      return "a window";
    case "monitor":
      return "your whole screen";
    default:
      return track.label ? `"${track.label}"` : "your screen";
  }
}

export function useScreenShare(): ScreenShare {
  const supported = useSyncExternalStore(noop, isSupported, () => false);
  const [status, setStatus] = useState<ScreenShareStatus>("idle");
  const [label, setLabel] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const preview = useRef<HTMLVideoElement | null>(null);

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (video.current) {
      video.current.srcObject = null;
      video.current = null;
    }
    if (preview.current) preview.current.srcObject = null;
    setStatus("idle");
    setLabel(null);
  }, []);

  const start = useCallback(async () => {
    if (!isSupported()) {
      setNotice("Screen sharing is not available in this browser.");
      return;
    }
    setNotice(null);
    setStatus("requesting");
    try {
      const media = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 5, max: 10 } }, audio: false });
      const track = media.getVideoTracks()[0];
      if (!track) throw new Error("No video track");
      stream.current = media;
      const element = document.createElement("video");
      element.muted = true;
      element.playsInline = true;
      element.srcObject = media;
      await element.play().catch(() => undefined);
      video.current = element;
      if (preview.current) {
        preview.current.srcObject = media;
        void preview.current.play().catch(() => undefined);
      }
      setLabel(describeSurface(track));
      setStatus("sharing");
      // The browser's own "stop sharing" control, or closing the shared window, ends the track.
      track.addEventListener("ended", () => {
        stop();
        setNotice("Screen sharing ended.");
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : "";
      setStatus("idle");
      setNotice(
        name === "NotAllowedError" || name === "SecurityError"
          ? "You didn't allow screen sharing, so nothing was shared."
          : name === "NotFoundError" || name === "AbortError"
            ? "No screen, window or tab was picked."
            : "Screen sharing could not start.",
      );
    }
  }, [stop]);

  const capture = useCallback(async (): Promise<string | null> => {
    const element = video.current;
    if (!element || !stream.current) return null;
    for (let i = 0; i < 20 && element.videoWidth === 0; i++) await new Promise((r) => setTimeout(r, 50));
    if (element.videoWidth === 0) return null;
    const scale = Math.min(1, 1280 / element.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(element.videoWidth * scale);
    canvas.height = Math.round(element.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(element, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  }, []);

  const attachPreview = useCallback((element: HTMLVideoElement | null) => {
    preview.current = element;
    if (element && stream.current) {
      element.srcObject = stream.current;
      void element.play().catch(() => undefined);
    }
  }, []);

  // Leaving the page ends the share: nothing keeps running in the background.
  useEffect(() => stop, [stop]);

  return { status: supported ? status : "unsupported", label, notice, start, stop, capture, attachPreview };
}
