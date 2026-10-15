import { useEffect, useState } from "react";
import { displayConfig } from "@/lib/display-config";
import type { VisitorEvent } from "@/services/mock-event-service";
import { BimanBrandHeader } from "./BimanBrandHeader";

/** Persistent in-window information display: logo, compass, clock, station, status. */
export function WindowHud({ current }: { current: VisitorEvent | null }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const time = now ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) : "--:--";
  const date = now ? now.toLocaleDateString([], { weekday: "short", day: "2-digit", month: "short" }).toUpperCase() : "";
  const status = current ? `${current.type} · in progress` : "Standby · awaiting visitor";
  const statusDot = current ? (current.type === "ENTRY" ? "bg-entry" : "bg-exit") : "bg-primary";

  return (
    <div className="pointer-events-none absolute inset-0 z-20 hud-text">
      {/* top band */}
      <div className="absolute inset-x-[4.5vw] top-[4.5vh] flex items-start justify-between">
        <BimanBrandHeader />
        <div className="hidden w-[26vw] flex-col items-center md:flex">
          <div className="font-mono text-[1.1vh] tracking-[0.35em] text-hud/75">23° 50′ N · 90° 24′ E</div>
          <div className="mt-[0.8vh] flex w-full items-end justify-between">
            {Array.from({ length: 49 }).map((_, i) => (
              <span key={i} className={`w-px hud-line ${i % 12 === 0 ? "h-[1.4vh]" : "h-[0.7vh]"}`} />
            ))}
          </div>
          <div className="mt-[0.5vh] flex w-full justify-between font-mono text-[1vh] tracking-[0.3em] text-hud/60">
            <span>W</span><span>NW</span><span>N</span><span>NE</span><span>E</span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-display text-[6vh] font-bold leading-none tabular-nums">{time}</div>
          <div className="mt-[0.6vh] font-mono text-[1.2vh] tracking-[0.3em] text-hud/75">{date} · DHAKA</div>
        </div>
      </div>

      {/* bottom band */}
      <div className="absolute inset-x-[4.5vw] bottom-[4.5vh]">
        <div className="h-px hud-line" />
        <div className="mt-[1.2vh] flex items-center justify-between font-mono text-[1.3vh] uppercase tracking-[0.28em]">
          <span className="flex items-center gap-[0.6vw]">
            <span className={`inline-block h-[0.9vh] w-[0.9vh] rounded-full ${statusDot} animate-blink`} />
            {status}
          </span>
          <span className="text-hud/75">{displayConfig.station.name}</span>
          <span className="text-hud/75">Station {displayConfig.station.code}</span>
        </div>
      </div>
    </div>
  );
}
