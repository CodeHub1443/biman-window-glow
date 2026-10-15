import { createFileRoute, Link } from "@tanstack/react-router";
import { Maximize, Moon, PlaneLanding, PlaneTakeoff, RotateCcw, Sun, Copy, Layers, ImageOff } from "lucide-react";
import { useState } from "react";
import { VisitorDisplay } from "@/components/VisitorDisplay";
import { useVisitorDisplay } from "@/hooks/use-visitor-display";
import { mockEventService, type VisitorEvent } from "@/services/mock-event-service";
import { displayConfig } from "@/lib/display-config";
import { useTheme } from "@/components/ThemeProvider";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Visitor Display — Biman Bangladesh Airlines" },
      { name: "description", content: "Airplane-window visitor greeting display for Biman Bangladesh Airlines." },
      { property: "og:title", content: "Visitor Display — Biman Bangladesh Airlines" },
      { property: "og:description", content: "Airplane-window visitor greeting display for Biman Bangladesh Airlines." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const [duration, setDuration] = useState(displayConfig.greetingDurationMs);
  const { state, resetToIdle } = useVisitorDisplay(mockEventService, duration);
  const { theme, toggle } = useTheme();
  const [last, setLast] = useState<VisitorEvent | null>(null);

  const fire = (type: "ENTRY" | "EXIT", noFace = false) => {
    const e = mockEventService.createDemoEvent(type, { noFace });
    setLast(e);
    mockEventService.emit(e);
  };
  const burst = () => ["ENTRY", "EXIT", "ENTRY"].forEach((t) => fire(t as "ENTRY" | "EXIT"));

  const btn = "inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground transition hover:bg-accent disabled:opacity-40";

  return (
    <div className="flex h-screen flex-col">
      <div className="min-h-0 flex-1">
        <VisitorDisplay state={state} />
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border bg-background px-4 py-3">
        <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Demo controls</span>
        <button className={btn} onClick={resetToIdle}><RotateCcw className="h-4 w-4" />Preview idle</button>
        <button className={`${btn} border-entry/60`} onClick={() => fire("ENTRY")}><PlaneLanding className="h-4 w-4" />Simulate entry</button>
        <button className={`${btn} border-exit/60`} onClick={() => fire("EXIT")}><PlaneTakeoff className="h-4 w-4" />Simulate exit</button>
        <button className={btn} onClick={burst}><Layers className="h-4 w-4" />Burst ×3</button>
        <button className={btn} disabled={!last} onClick={() => last && mockEventService.emit(last)}><Copy className="h-4 w-4" />Resend last ID</button>
        <button className={btn} onClick={() => fire("ENTRY", true)}><ImageOff className="h-4 w-4" />Entry, no face</button>
        <label className="ml-2 flex items-center gap-2 text-sm text-muted-foreground">
          Duration
          <input type="range" min={3000} max={15000} step={1000} value={duration} onChange={(e) => setDuration(+e.target.value)} className="accent-primary" />
          <span className="w-8 font-mono text-foreground">{duration / 1000}s</span>
        </label>
        <span className="font-mono text-xs text-muted-foreground">queue {state.queueLength} · duplicates blocked {state.suppressed}</span>
        <div className="ml-auto flex gap-2">
          <button className={btn} onClick={toggle} aria-label="Toggle theme">{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button>
          <Link to="/kiosk" target="_blank" className={btn}><Maximize className="h-4 w-4" />Open kiosk</Link>
        </div>
      </div>
    </div>
  );
}
