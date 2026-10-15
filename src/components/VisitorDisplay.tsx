import { displayConfig } from "@/lib/display-config";
import type { DisplayState } from "@/hooks/use-visitor-display";
import { AircraftWindowFrame } from "./AircraftWindowFrame";
import { IdleWindowVideo } from "./IdleWindowVideo";
import { VisitorGreetingOverlay } from "./VisitorGreetingOverlay";
import { WindowHud } from "./WindowHud";

export function VisitorDisplay({ state }: { state: DisplayState }) {
  const { current, leaving } = state;
  return (
    <div className="h-screen w-screen">
      <AircraftWindowFrame>
        {/* Idle video stays mounted underneath every state to avoid black frames */}
        <IdleWindowVideo {...displayConfig.idleVideo} />
        {current && <VisitorGreetingOverlay key={current.id} event={current} leaving={leaving} />}
        <WindowHud current={current} />
      </AircraftWindowFrame>
    </div>
  );
}
