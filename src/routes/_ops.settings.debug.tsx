import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Play, RefreshCw, Square } from "lucide-react";
import { useEffect, useReducer, useState } from "react";
import stillLobby from "@/assets/roi-still-lobby.jpg";
import { DemoTag, EmptyState, field, ghostBtn, PageError, PageSkeleton, Panel } from "@/components/ops/ui";
import { StillBackdrop } from "@/components/settings/RoiEditor";
import { Notice } from "@/components/settings/form";
import { settingsHead } from "@/components/settings/sections";
import { settingsQueries } from "@/lib/ops-queries";
import { initialPreview, isPreviewActive, previewReducer, simulateConnectionTest, type PreviewStatus } from "@/lib/settings-logic";
import { cn } from "@/lib/utils";
import type { RoiConfig } from "@/types/settings";

export const Route = createFileRoute("/_ops/settings/debug")({
  loader: ({ context }) => context.queryClient.ensureQueryData(settingsQueries.cameras()).then(() => undefined),
  head: () => settingsHead("Debug Preview", "Manually started, simulated camera preview with detection and ROI overlays. The only place a camera preview may appear."),
  pendingComponent: PageSkeleton,
  errorComponent: ({ error }) => <PageError error={error} />,
  component: DebugPage,
});

/** Session policy: preview stops on leave, camera change, hidden tab, or after this long. */
const PREVIEW_SESSION_LIMIT_MS = 5 * 60_000;
const CONNECT_DELAY_MS = 1200;

const STATUS_LABEL: Record<PreviewStatus, { label: string; cls: string }> = {
  idle: { label: "Not started", cls: "text-muted-foreground" },
  connecting: { label: "Connecting (simulated)", cls: "text-gold" },
  streaming: { label: "Simulated stream running", cls: "text-primary" },
  reconnecting: { label: "Reconnecting (simulated)", cls: "text-gold" },
  stopped: { label: "Stopped", cls: "text-muted-foreground" },
  error: { label: "Error", cls: "text-destructive" },
};

function DebugPage() {
  const { data: cameras } = useSuspenseQuery(settingsQueries.cameras());
  const [state, dispatch] = useReducer(previewReducer, { ...initialPreview, cameraId: cameras[0]?.id ?? null });
  const [detections, setDetections] = useState(true);
  const [roiOverlay, setRoiOverlay] = useState(true);
  const [now, setNow] = useState(Date.now());
  const camera = cameras.find((c) => c.id === state.cameraId) ?? null;
  const { data: roi } = useQuery({ ...settingsQueries.roi(state.cameraId ?? ""), enabled: !!state.cameraId });
  const active = isPreviewActive(state);

  // Simulated connect: decides success or failure from the saved camera configuration only.
  useEffect(() => {
    if (!camera || (state.status !== "connecting" && state.status !== "reconnecting")) return;
    const t = setTimeout(() => {
      const r = simulateConnectionTest({ ...camera, password: "" }, Date.now());
      if (r.ok) dispatch({ type: "connected", now: Date.now() });
      else dispatch({ type: "failed", message: r.message, now: Date.now() });
    }, CONNECT_DELAY_MS);
    return () => clearTimeout(t);
  }, [state.status, camera]);

  // Simulated stats, demo warnings and the session time limit.
  useEffect(() => {
    if (state.status !== "streaming") return;
    let tick = 0;
    const t = setInterval(() => {
      tick += 1;
      const degraded = camera?.id === "CAM-2X";
      dispatch({ type: "stats", fps: Math.round((degraded ? 22.5 : 24.6) + Math.random() * 0.8), latencyMs: Math.round((degraded ? 260 : 140) + Math.random() * 60) });
      if (degraded && tick % 8 === 0) dispatch({ type: "warn", message: "Simulated: frame drops above 5% in the last 8 s.", now: Date.now() });
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(t);
  }, [state.status, camera?.id]);

  useEffect(() => {
    if (state.status === "streaming" && state.startedAt && now - state.startedAt > PREVIEW_SESSION_LIMIT_MS)
      dispatch({ type: "stop", reason: "5-minute session limit reached", now: Date.now() });
  }, [now, state.status, state.startedAt]);

  useEffect(() => {
    const onHide = () => document.hidden && dispatch({ type: "stop", reason: "tab hidden", now: Date.now() });
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  if (!cameras.length) return <Panel><EmptyState title="No cameras configured" hint="Add a camera before using the debug preview." /></Panel>;

  const elapsed = state.startedAt ? Math.max(0, Math.round((now - state.startedAt) / 1000)) : 0;
  const s = STATUS_LABEL[state.status];

  return (
    <div className="space-y-4">
      <Notice tone="warning" title="Simulated preview · no camera stream is opened">
        This page is the only place in the system where a camera preview may appear. In this prototype the preview is a labelled simulation over a still image;
        it never connects to a camera. Preview stops when you leave this page, switch camera, hide the tab, or after 5 minutes.
      </Notice>

      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1.5">
          <span className="block text-sm font-medium">Camera</span>
          <select value={state.cameraId ?? ""} onChange={(e) => dispatch({ type: "select", cameraId: e.target.value, now: Date.now() })} className={cn(field, "min-w-64")}>
            {cameras.map((c) => <option key={c.id} value={c.id}>{c.id} · {c.name}{c.enabled ? "" : " (disabled)"}</option>)}
          </select>
        </label>
        {!active ? (
          <button onClick={() => state.cameraId && dispatch({ type: "start", cameraId: state.cameraId, now: Date.now() })} className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
            <Play className="h-4 w-4" />Start preview
          </button>
        ) : (
          <button onClick={() => dispatch({ type: "stop", reason: "stopped by operator", now: Date.now() })} className="inline-flex h-9 items-center gap-2 rounded-md bg-destructive px-4 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90">
            <Square className="h-4 w-4" />Stop preview
          </button>
        )}
        <button onClick={() => dispatch({ type: "reconnect", now: Date.now() })} disabled={state.status === "idle" || state.status === "stopped" || state.status === "connecting"} className={ghostBtn}>
          <RefreshCw className="h-4 w-4" />Reconnect
        </button>
        <div className="ml-auto flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={detections} onChange={(e) => setDetections(e.target.checked)} className="accent-primary" />Detection overlay</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={roiOverlay} onChange={(e) => setRoiOverlay(e.target.checked)} className="accent-primary" />ROI overlay</label>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="relative aspect-video overflow-hidden rounded-md border border-border bg-muted" aria-live="polite" aria-label="Preview area">
          {state.status === "streaming" ? (
            <SimulatedFeed roi={roiOverlay ? roi : undefined} detections={detections} />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
              <div className={cn("font-mono text-xs uppercase tracking-[0.25em]", s.cls)}>{s.label}</div>
              <p className="max-w-sm text-sm text-muted-foreground">
                {state.status === "error" ? state.error : state.status === "connecting" || state.status === "reconnecting" ? "Checking saved configuration…" : "Press Start preview. Nothing starts automatically."}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Panel title="Stream">
            <dl className="grid grid-cols-2 gap-y-2 font-mono text-xs">
              <dt className="text-muted-foreground">State</dt><dd className={s.cls}>{state.status}</dd>
              <dt className="text-muted-foreground">Camera</dt><dd>{camera?.id ?? "—"}</dd>
              <dt className="text-muted-foreground">Transport</dt><dd>{camera?.transport.toUpperCase() ?? "—"}</dd>
              <dt className="text-muted-foreground">FPS</dt><dd>{state.fps != null ? `${state.fps} (sim)` : "n/a"}</dd>
              <dt className="text-muted-foreground">Latency</dt><dd>{state.latencyMs != null ? `${state.latencyMs} ms (sim)` : "n/a"}</dd>
              <dt className="text-muted-foreground">Session</dt><dd>{state.status === "streaming" ? `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")} / 5:00` : "—"}</dd>
              <dt className="text-muted-foreground">Attempts</dt><dd>{state.attempts}</dd>
            </dl>
          </Panel>
          <Panel title="Diagnostics" meta={<DemoTag>simulated</DemoTag>}>
            {state.log.length === 0 ? <p className="text-sm text-muted-foreground">No messages yet.</p> : (
              <ol className="max-h-64 space-y-1.5 overflow-y-auto font-mono text-[11px]">
                {state.log.map((l, i) => (
                  <li key={`${l.at}-${i}`} className="flex gap-2">
                    <span className="shrink-0 text-muted-foreground">{new Date(l.at).toLocaleTimeString([], { hour12: false })}</span>
                    <span className={l.level === "error" ? "text-destructive" : l.level === "warning" ? "text-gold" : ""}>{l.message}</span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function SimulatedFeed({ roi, detections }: { roi: RoiConfig | undefined; detections: boolean }) {
  return (
    <div className="absolute inset-0">
      <StillBackdrop still={roi?.stillImage ?? "lobby"} src={stillLobby} />
      <div className="absolute inset-0 sim-static" />
      {roi && (
        <svg viewBox="0 0 1600 900" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
          {roi.zones.map((z) => (
            <polygon key={z.id} points={z.points.map((p) => `${p.x * 1600},${p.y * 900}`).join(" ")} className={z.kind === "entry" ? "text-entry" : "text-exit"} fill="currentColor" fillOpacity={0.15} stroke="currentColor" strokeWidth={3} />
          ))}
          {roi.line.enabled && <line x1={roi.line.a.x * 1600} y1={roi.line.a.y * 900} x2={roi.line.b.x * 1600} y2={roi.line.b.y * 900} className="text-gold" stroke="currentColor" strokeWidth={5} strokeDasharray="20 10" />}
        </svg>
      )}
      {detections && (
        <div className="absolute left-[30%] top-[30%] h-[38%] w-[12%] animate-roam rounded-sm border-2 border-primary">
          <span className="absolute -top-5 left-0 whitespace-nowrap bg-primary px-1 font-mono text-[10px] text-primary-foreground">person 0.87 · sim</span>
        </div>
      )}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-background/80 px-2 py-1 font-mono text-[10px] uppercase tracking-wider">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 animate-blink rounded-full bg-destructive" />Simulated preview · not a live stream</span>
        <span className="text-muted-foreground">demo still + synthetic overlay</span>
      </div>
    </div>
  );
}
