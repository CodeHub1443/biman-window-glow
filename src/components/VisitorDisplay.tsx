import { displayConfig, type DisplayConfig } from "@/lib/display-config";
import type { DisplayState } from "@/hooks/use-visitor-display";
import { AircraftWindowFrame } from "./AircraftWindowFrame";
import { IdleWindowVideo } from "./IdleWindowVideo";
import { VisitorGreetingOverlay } from "./VisitorGreetingOverlay";
import { WindowHud } from "./WindowHud";

/** `config` defaults to the built-in display configuration; Settings previews pass a draft. */
export function VisitorDisplay({ state, config = displayConfig }: { state: DisplayState; config?: DisplayConfig }) {
  const { current, leaving } = state;
  return (
    <div className="h-screen w-screen">
      <AircraftWindowFrame>
        {/* Idle video stays mounted underneath every state to avoid black frames */}
        <IdleWindowVideo {...config.idleVideo} motion={config.motion} />
        {current && <VisitorGreetingOverlay key={current.id} event={current} leaving={leaving} config={config} />}
        <WindowHud current={current} config={config} />
      </AircraftWindowFrame>
    </div>
  );
}
