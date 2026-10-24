import { PlaneLanding, PlaneTakeoff } from "lucide-react";
import type { VisitorEvent } from "@/services/mock-event-service";
import { displayConfig, type DisplayConfig } from "@/lib/display-config";
import { VisitorFaceCapture } from "./VisitorFaceCapture";

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

/** Full-canvas greeting composed over the window view. */
export function VisitorGreetingOverlay({ event, leaving, config = displayConfig }: { event: VisitorEvent; leaving: boolean; config?: DisplayConfig }) {
  const isEntry = event.type === "ENTRY";
  const copy = isEntry ? config.entry : config.exit;
  const motion = config.motion === "full";
  const Icon = isEntry ? PlaneLanding : PlaneTakeoff;
  const tag = isEntry ? "bg-entry" : "bg-exit";

  return (
    <div className={`absolute inset-0 z-10 ${leaving && motion ? "animate-greet-out" : ""}`}>
      <div className="absolute inset-0 greeting-scrim" />
      <div className={`absolute inset-x-[6vw] inset-y-[15vh] flex items-center gap-[4vw] hud-text ${!motion ? "" : isEntry ? "animate-greet-in" : "animate-greet-depart"}`}>
        <div className="h-[58vh] max-h-[42vw] shrink-0 aspect-square">
          <VisitorFaceCapture src={event.faceImageUrl} isDemo={event.isDemo} accent={isEntry ? "entry" : "exit"} />
        </div>

        <div className="min-w-0 flex-1">
          <span className={`inline-flex items-center gap-[0.6vw] rounded-sm px-[0.8vw] py-[0.5vh] font-mono text-[1.5vh] font-bold uppercase tracking-[0.3em] text-hud-ink ${tag}`}>
            <Icon className="h-[1.8vh] w-[1.8vh]" /> {event.type}
          </span>
          <h1 className="mt-[2.5vh] font-display text-[clamp(2.5rem,9vh,9rem)] font-bold leading-[0.92] tracking-tight">
            {copy.headline}
          </h1>
          <p className="mt-[2.5vh] max-w-[40vw] text-[clamp(1rem,2.8vh,2.4rem)] font-medium text-hud/90">{copy.sub}</p>

          <div className="mt-[5vh] grid max-w-[42vw] grid-cols-3 gap-[2vw] border-t border-hud-dim pt-[2vh] font-mono uppercase">
            <Field label="Time" value={fmtTime(event.timestamp)} />
            <Field label={isEntry ? "Entrance" : "Exit"} value={event.stationLabel} />
            {event.cameraLabel && <Field label="Camera" value={event.cameraLabel} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[1.1vh] tracking-[0.3em] text-hud/60">{label}</div>
      <div className="mt-[0.6vh] text-[1.7vh] tracking-[0.15em]">{value}</div>
    </div>
  );
}
