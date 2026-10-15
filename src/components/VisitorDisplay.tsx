import { displayConfig } from "@/lib/display-config";
import type { DisplayState } from "@/hooks/use-visitor-display";
import { AircraftWindowFrame } from "./AircraftWindowFrame";
import { IdleWindowVideo } from "./IdleWindowVideo";
import { VisitorGreetingOverlay } from "./VisitorGreetingOverlay";
import { WindowHud } from "./WindowHud";
import { BimanBrandHeader } from "./BimanBrandHeader";

export function VisitorDisplay({ state, kiosk = false }: { state: DisplayState; kiosk?: boolean }) {
  const { current, leaving } = state;
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden cabin-wall">
      <div className="absolute left-[3vw] top-[4vh] z-40">
        <BimanBrandHeader />
      </div>
      <div className="absolute right-[3vw] top-[4vh] z-40 text-right font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        <div className="text-foreground">{displayConfig.station.name}</div>
        <div>{current ? `${current.type} event` : "Idle"}</div>
      </div>
      {!kiosk && (
        <div className="absolute bottom-[4vh] left-[3vw] z-40 font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          Demo mode · simulated events only
        </div>
      )}

      <div className={kiosk ? "h-[92vh]" : "h-[80vh]"}>
        <AircraftWindowFrame>
          {/* Idle video stays mounted underneath to avoid black frames */}
          <IdleWindowVideo {...displayConfig.idleVideo} />
          {!current && <WindowHud />}
          {current && <VisitorGreetingOverlay key={current.id} event={current} leaving={leaving} />}
        </AircraftWindowFrame>
      </div>
    </div>
  );
}
