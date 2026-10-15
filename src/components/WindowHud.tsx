import { useEffect, useState } from "react";
import { displayConfig } from "@/lib/display-config";

/** Restrained flight-HUD overlay shown over the idle view, inspired by the reference. */
export function WindowHud() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const time = now ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--";
  const ticks = Array.from({ length: 41 });

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col px-[12%] pb-[13%] pt-[13%] hud-text">
      <div className="text-center font-mono text-[10px] tracking-[0.3em] text-hud/70">23° 50′ 34″ N · 90° 24′ 02″ E</div>
      <div className="mt-2 flex items-end justify-between">
        {ticks.map((_, i) => (
          <span key={i} className={`w-px hud-line ${i % 10 === 0 ? "h-3" : "h-1.5"}`} />
        ))}
      </div>
      <div className="mt-6 flex items-end justify-between">
        <span className="font-display text-[clamp(2rem,5vh,4rem)] font-bold leading-none">{time}</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-hud/70">
          <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-entry animate-blink" /> Live
        </span>
      </div>
      <div className="mt-2 h-px hud-line" />
      <div className="mt-[6%] font-display text-[clamp(2.2rem,6vh,5rem)] font-bold leading-none tracking-tight">Dhaka</div>
      <div className="mt-2 font-mono text-xs tracking-[0.25em]">
        {displayConfig.station.code} <span className="text-hud/60">→</span> WELCOME
      </div>

      <div className="mt-auto">
        <div className="flex items-end justify-between">
          <span className="font-display text-3xl font-bold">{displayConfig.station.code}</span>
          <span className="rounded-sm bg-hud px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-hud-ink">
            Standby
          </span>
        </div>
        <div className="mt-2 h-px hud-line" />
        <div className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-hud/80">
          <span>{displayConfig.station.name}</span>
          <span>Awaiting visitor</span>
        </div>
      </div>
    </div>
  );
}
