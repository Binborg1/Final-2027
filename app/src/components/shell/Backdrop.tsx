import Image from "next/image";

/**
 * The full-bleed library-café photo behind every screen (Raymond Yeung, Unsplash;
 * see public/backgrounds/CREDITS.md). The pre-blurred copy is already painted on
 * <html>, so the page never flashes empty while this loads. next/image serves a
 * width that fits the screen, so phones download a small copy.
 */
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <Image src="/backgrounds/oak-library-2560.webp" alt="" fill sizes="100vw" loading="eager" fetchPriority="high" className="object-cover object-center" />
    </div>
  );
}
