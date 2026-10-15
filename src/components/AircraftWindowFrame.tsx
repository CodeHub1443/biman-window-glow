import type { ReactNode } from "react";

/** Layered aircraft window: bezel → recess → glass. Content is clipped to the glass. */
export function AircraftWindowFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative aspect-[0.7] h-full max-h-full">
      <div className="absolute inset-0 window-shape window-bezel" />
      <div className="absolute inset-[5%] window-shape window-recess" />
      <div className="absolute inset-[7%] isolate overflow-hidden window-shape">
        {children}
        <div className="pointer-events-none absolute inset-0 z-30 scanlines opacity-40" />
        <div className="pointer-events-none absolute inset-0 z-30 window-shape window-glass" />
      </div>
    </div>
  );
}
