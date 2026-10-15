import { PlaneLanding, PlaneTakeoff } from "lucide-react";
import type { VisitorEvent } from "@/services/mock-event-service";
import { displayConfig } from "@/lib/display-config";
import { VisitorFaceCapture } from "./VisitorFaceCapture";

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();

export function VisitorGreetingOverlay({ event, leaving }: { event: VisitorEvent; leaving: boolean }) {
  const isEntry = event.type === "ENTRY";
  const copy = isEntry ? displayConfig.entry : displayConfig.exit;
  const accent = isEntry ? "entry" : "exit";
  const Icon = isEntry ? PlaneLanding : PlaneTakeoff;

  return (
    <div className={`absolute inset-0 z-20 ${leaving ? "animate-greet-out" : ""}`}>
      <div className="absolute inset-0 bg-gradient-to-b from-hud-ink/80 via-hud-ink/55 to-hud-ink/85 backdrop-blur-[2px]" />
      <div className={`relative flex h-full flex-col px-[11%] pb-[12%] pt-[14%] ${isEntry ? "animate-greet-in" : "animate-greet-depart"}`}>
        <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.25em] hud-text">
          <span className={`flex items-center gap-2 rounded-sm px-2 py-1 font-bold text-hud-ink ${isEntry ? "bg-entry" : "bg-exit"}`}>
            <Icon className="h-3.5 w-3.5" /> {event.type}
          </span>
          <span>{fmtDate(event.timestamp)}</span>
        </div>
        <div className="mt-3 h-px hud-line" />

        <div className="mx-auto mt-[8%] w-[62%]">
          <VisitorFaceCapture src={event.faceImageUrl} isDemo={event.isDemo} accent={accent} />
        </div>

        <h1 className="mt-[8%] text-center font-display text-[clamp(1.8rem,3.4vh,3.4rem)] font-bold leading-[1.02] tracking-tight hud-text">
          {copy.headline}
        </h1>
        <p className="mt-3 text-center text-[clamp(0.9rem,1.6vh,1.4rem)] text-hud/85">{copy.sub}</p>

        <div className="mt-auto">
          <div className="h-px hud-line" />
          <div className="mt-3 grid grid-cols-2 gap-y-1 font-mono text-[11px] uppercase tracking-[0.2em] hud-text">
            <span className="text-hud/60">Time</span>
            <span className="text-right">{fmtTime(event.timestamp)}</span>
            <span className="text-hud/60">{isEntry ? "Entrance" : "Exit"}</span>
            <span className="text-right">{event.stationLabel}</span>
            {event.cameraLabel && (
              <>
                <span className="text-hud/60">Camera</span>
                <span className="text-right">{event.cameraLabel}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
