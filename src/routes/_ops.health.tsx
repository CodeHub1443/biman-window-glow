import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AlertTriangle, Cpu, Monitor, Network, Speaker, Video } from "lucide-react";
import { PageError, PageHeader, PageSkeleton, Panel, StatusPill } from "@/components/ops/ui";
import { healthQuery } from "@/lib/ops-queries";
import { formatTime } from "@/lib/ops-data";
import { cn } from "@/lib/utils";
import type { DeviceHealth } from "@/types/operations";

export const Route = createFileRoute("/_ops/health")({
  loader: ({ context }) => context.queryClient.ensureQueryData(healthQuery()).then(() => undefined),
  head: () => ({
    meta: [
      { title: "System Health — Biman Visitor Operations" },
      { name: "description", content: "Simulated status of both stations, cameras, edge devices, displays, speakers and the PoE switch." },
      { property: "og:title", content: "System Health — Biman Visitor Operations" },
      { property: "og:description", content: "Simulated status of both stations, cameras, edge devices, displays, speakers and the PoE switch." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  pendingComponent: PageSkeleton,
  errorComponent: ({ error }) => <PageError error={error} />,
  component: HealthPage,
});

const ICON = { edge: Cpu, camera: Video, display: Monitor, speaker: Speaker, switch: Network };
const ago = (ts: number) => {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  return s < 60 ? `${s}s ago` : `${Math.round(s / 60)}m ago`;
};

function Meter({ label, value, unit = "%", warn = 80 }: { label: string; value: number; unit?: string; warn?: number }) {
  const pct = unit === "%" ? value : Math.min(100, value);
  return (
    <div>
      <div className="flex justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground"><span>{label}</span><span className="text-foreground">{value}{unit}</span></div>
      <div className="mt-1 h-1.5 rounded-full bg-muted"><div className={cn("h-full rounded-full", value >= warn ? "bg-gold" : "bg-primary")} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function DeviceRow({ d }: { d: DeviceHealth }) {
  const Icon = ICON[d.kind];
  return (
    <div className={cn("rounded-md border p-3", d.status === "offline" ? "border-destructive/50 bg-destructive/5" : "border-border")}>
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{d.label}</div>
          <div className="font-mono text-[11px] text-muted-foreground">{d.model}{d.port ? ` · port ${d.port}` : ""}{d.detail ? ` · ${d.detail}` : ""}</div>
        </div>
        <div className="text-right">
          <StatusPill status={d.status} />
          <div className="font-mono text-[10px] text-muted-foreground">heartbeat {ago(d.lastHeartbeat)}</div>
        </div>
      </div>
      {d.status === "offline" && <div className="mt-2 text-xs text-destructive">Disconnected — no heartbeat received.</div>}
      {d.metrics && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Meter label="CPU" value={d.metrics.cpu} />
          <Meter label="GPU" value={d.metrics.gpu} />
          <Meter label="Memory" value={d.metrics.mem} />
          <Meter label="Temp" value={d.metrics.tempC} unit="°C" warn={70} />
        </div>
      )}
    </div>
  );
}

function HealthPage() {
  const { data } = useSuspenseQuery(healthQuery());
  return (
    <>
      <div role="status" className="mb-5 flex items-center gap-3 rounded-lg border border-gold/60 bg-gold/10 px-4 py-3 font-mono text-xs font-semibold uppercase tracking-[0.2em]">
        <AlertTriangle className="h-4 w-4" /> Demo data — no hardware connected
      </div>
      <PageHeader eyebrow="SYS · Health" title="System Health" description={`Two stations and one central PoE switch. Simulated telemetry refreshes every 5 seconds (last ${formatTime(data.generatedAt)}).`} />

      <div className="grid gap-4 xl:grid-cols-2">
        {data.stations.map((s) => (
          <Panel key={s.station.id} title={s.station.label} meta={<StatusPill status={s.devices.some((d) => d.status === "offline") ? "degraded" : "online"} />}>
            <div className="mb-4 grid grid-cols-3 gap-3 rounded-md bg-muted/50 p-3 text-center">
              <div><div className="font-mono text-[10px] uppercase text-muted-foreground">Event pipeline</div><StatusPill status={s.pipeline.status} /></div>
              <div><div className="font-mono text-[10px] uppercase text-muted-foreground">Events / hour</div><div className="font-display text-lg font-semibold">{s.pipeline.eventsLastHour}</div></div>
              <div><div className="font-mono text-[10px] uppercase text-muted-foreground">Latency · queue</div><div className="font-display text-lg font-semibold">{s.pipeline.avgLatencyMs}ms · {s.pipeline.queueDepth}</div></div>
            </div>
            <div className="space-y-2">{s.devices.map((d) => <DeviceRow key={d.id} d={d} />)}</div>
            <div className="mt-3 font-mono text-[11px] text-muted-foreground">
              Audio: {s.audio.status === "offline" ? "unavailable" : `volume ${s.audio.volume}% · last greeting ${s.audio.lastPlayed ? ago(s.audio.lastPlayed) : "—"}`}
            </div>
          </Panel>
        ))}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[3fr_2fr]">
        <Panel title="Central PoE switch" meta={<StatusPill status={data.network.device.status} />}>
          <div className="mb-3 text-sm text-muted-foreground">{data.network.device.model} · {data.network.device.detail}</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {data.network.ports.map((p) => (
              <div key={p.port} className={cn("rounded-md border p-2", p.status === "unused" ? "border-dashed border-border opacity-60" : "border-border")}>
                <div className="flex items-center justify-between font-mono text-[10px] uppercase text-muted-foreground"><span>Port {p.port}</span><StatusPill status={p.status} /></div>
                <div className="mt-1 truncate text-xs">{p.label}</div>
                {p.status !== "unused" && <div className="font-mono text-[10px] text-muted-foreground">{p.poeWatts} W · {p.linkMbps} Mbps</div>}
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Recent errors & events">
          <ul className="space-y-2">
            {data.log.map((l) => (
              <li key={l.id} className="flex gap-3 text-sm">
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", l.severity === "error" ? "bg-destructive" : l.severity === "warning" ? "bg-gold" : "bg-muted-foreground/50")} />
                <div className="min-w-0">
                  <div className="font-mono text-[11px] text-muted-foreground">{formatTime(l.at)} · {l.source} · {l.severity}</div>
                  <div>{l.message}</div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
