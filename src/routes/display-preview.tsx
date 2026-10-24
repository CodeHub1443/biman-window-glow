import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { VisitorDisplay } from "@/components/VisitorDisplay";
import { useVisitorDisplay } from "@/hooks/use-visitor-display";
import type { PreviewMessage } from "@/lib/display-images";
import { resolveDisplayConfig } from "@/lib/live-display-config";
import { settingsService } from "@/lib/ops-queries";
import { mockEventService, type VisitorEvent, type VisitorEventSource } from "@/services/mock-event-service";
import type { VisitorDisplaySettings } from "@/types/settings";

// Settings preview of the existing Visitor Display. Events here are local to this frame and are
// never broadcast to / or /kiosk.
export const Route = createFileRoute("/display-preview")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Display Preview — Biman Visitor Operations" },
      { name: "description", content: "Settings preview of the Biman airplane-window visitor display." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Display Preview — Biman Visitor Operations" },
      { property: "og:description", content: "Settings preview of the Biman airplane-window visitor display." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DisplayPreview,
});

function createLocalSource() {
  const listeners = new Set<(e: VisitorEvent) => void>();
  const source: VisitorEventSource = { subscribe: (cb) => { listeners.add(cb); return () => void listeners.delete(cb); } };
  return { source, emit: (e: VisitorEvent) => listeners.forEach((l) => l(e)) };
}

function DisplayPreview() {
  const [settings, setSettings] = useState<VisitorDisplaySettings | null>(null);
  const local = useMemo(createLocalSource, []);
  const config = useMemo(() => resolveDisplayConfig(settings), [settings]);
  const { state, resetToIdle } = useVisitorDisplay(local.source, config.greetingDurationMs);
  const embedded = typeof window !== "undefined" && window.parent !== window;

  useEffect(() => {
    if (!embedded) {
      void settingsService.getDisplay().then(setSettings);
      return;
    }
    const onMsg = (e: MessageEvent<PreviewMessage>) => {
      if (e.origin !== window.location.origin || e.source !== window.parent || e.data?.source !== "biman-settings") return;
      if (e.data.type === "config") setSettings(e.data.settings);
      if (e.data.type === "show") {
        if (e.data.state === "idle") resetToIdle();
        else local.emit(mockEventService.createDemoEvent(e.data.state === "entry" ? "ENTRY" : "EXIT"));
      }
    };
    window.addEventListener("message", onMsg);
    window.parent.postMessage({ source: "biman-display-preview", type: "ready" } satisfies PreviewMessage, window.location.origin);
    return () => window.removeEventListener("message", onMsg);
  }, [embedded, local, resetToIdle]);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <VisitorDisplay state={state} config={config} />
      {!embedded && (
        <div className="fixed bottom-4 right-4 z-50 flex gap-2">
          <button onClick={resetToIdle} className="rounded-md border border-border bg-popover/90 px-3 py-1.5 text-xs text-popover-foreground">Idle</button>
          <button onClick={() => local.emit(mockEventService.createDemoEvent("ENTRY"))} className="rounded-md border border-border bg-popover/90 px-3 py-1.5 text-xs text-popover-foreground">Entry</button>
          <button onClick={() => local.emit(mockEventService.createDemoEvent("EXIT"))} className="rounded-md border border-border bg-popover/90 px-3 py-1.5 text-xs text-popover-foreground">Exit</button>
        </div>
      )}
      <div className="pointer-events-none fixed left-4 top-4 z-50 rounded-sm bg-popover/85 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-popover-foreground">Settings preview</div>
    </div>
  );
}
