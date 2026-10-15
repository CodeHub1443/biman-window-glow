import { createFileRoute, Link } from "@tanstack/react-router";
import { Maximize, Moon, PlaneLanding, PlaneTakeoff, RotateCcw, Sun, Copy, Layers, ImageOff, SlidersHorizontal, X } from "lucide-react";
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
      { name: "description", content: "Full-screen airplane-window visitor greeting display for Biman Bangladesh Airlines." },
      { property: "og:title", content: "Visitor Display — Biman Bangladesh Airlines" },
      { property: "og:description", content: "Full-screen airplane-window visitor greeting display for Biman Bangladesh Airlines." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const btn =
  "inline-flex w-full items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground transition hover:bg-accent disabled:opacity-40";

function Index() {
  const [duration, setDuration] = useState(displayConfig.greetingDurationMs);
  const { state, resetToIdle } = useVisitorDisplay(mockEventService, duration);
  const { theme, toggle } = useTheme();
  const [last, setLast] = useState<VisitorEvent | null>(null);
  const [open, setOpen] = useState(false);

  const fire = (type: "ENTRY" | "EXIT", noFace = false) => {
    const e = mockEventService.createDemoEvent(type, { noFace });
    setLast(e);
    mockEventService.emit(e);
  };
  const burst = () => (["ENTRY", "EXIT", "ENTRY"] as const).forEach((t) => fire(t));

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <VisitorDisplay state={state} />

      {/* Developer panel — floats over the bezel, never shrinks the display. Not rendered in /kiosk. */}
      <div className="fixed bottom-6 right-6 z-50">
        {open ? (
          <div className="w-72 rounded-lg border border-border bg-popover/95 p-4 text-popover-foreground shadow-2xl backdrop-blur">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Demo controls</span>
              <button onClick={() => setOpen(false)} aria-label="Close demo controls" className="rounded p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <button className={btn} onClick={resetToIdle}><RotateCcw className="h-4 w-4" />Preview idle</button>
              <button className={`${btn} border-entry/60`} onClick={() => fire("ENTRY")}><PlaneLanding className="h-4 w-4" />Simulate entry</button>
              <button className={`${btn} border-exit/60`} onClick={() => fire("EXIT")}><PlaneTakeoff className="h-4 w-4" />Simulate exit</button>
              <div className="grid grid-cols-2 gap-2">
                <button className={btn} onClick={burst}><Layers className="h-4 w-4" />Burst ×3</button>
                <button className={btn} disabled={!last} onClick={() => last && mockEventService.emit(last)}><Copy className="h-4 w-4" />Resend</button>
              </div>
              <button className={btn} onClick={() => fire("ENTRY", true)}><ImageOff className="h-4 w-4" />Entry, no face</button>
            </div>
            <label className="mt-4 block text-sm text-muted-foreground">
              Greeting duration <span className="font-mono text-foreground">{duration / 1000}s</span>
              <input type="range" min={3000} max={15000} step={1000} value={duration} onChange={(e) => setDuration(+e.target.value)} className="mt-1 w-full accent-primary" />
            </label>
            <div className="mt-2 font-mono text-xs text-muted-foreground">queue {state.queueLength} · duplicates blocked {state.suppressed}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button className={btn} onClick={toggle}>{theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}Theme</button>
              <Link to="/kiosk" target="_blank" className={btn}><Maximize className="h-4 w-4" />Kiosk</Link>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2 rounded-full border border-border bg-popover/70 px-3 py-2 text-xs font-medium text-popover-foreground opacity-60 backdrop-blur transition hover:opacity-100"
          >
            <SlidersHorizontal className="h-4 w-4" /> Demo
          </button>
        )}
      </div>
    </div>
  );
}
