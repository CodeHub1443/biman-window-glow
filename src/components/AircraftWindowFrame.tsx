import type { ReactNode } from "react";

/** The whole screen is the window: a thin bezel at the edges, the opening fills ~92% of the area. */
export function AircraftWindowFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative h-full w-full overflow-hidden window-bezel">
      <div className="absolute inset-x-[1.6vw] inset-y-[2.2vh] isolate overflow-hidden window-opening">
        {children}
        <div className="pointer-events-none absolute inset-0 z-30 scanlines opacity-25" />
        <div className="pointer-events-none absolute inset-0 z-30 window-opening window-glass" />
      </div>
    </div>
  );
}
