import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Download, Info } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, Line, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { axis, chartTooltip, DemoTag, EmptyState, field, ghostBtn, PageError, PageHeader, PageSkeleton, Panel } from "@/components/ops/ui";
import { analyticsQuery } from "@/lib/ops-queries";
import { dhakaDateKey, formatDuration, STATIONS, toCsv } from "@/lib/ops-data";
import type { DwellStatsBlock } from "@/types/operations";

const searchSchema = z.object({
  from: fallback(z.string(), "").default(""),
  to: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/_ops/analytics")({
  validateSearch: zodValidator(searchSchema),
  loaderDeps: ({ search }) => ({ from: search.from, to: search.to }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(analyticsQuery(deps)).then(() => undefined),
  head: () => ({
    meta: [
      { title: "Dwell Time Analytics — Biman Visitor Operations" },
      { name: "description", content: "Measured and estimated visitor dwell time, trends, unmatched events and CSV export." },
      { property: "og:title", content: "Dwell Time Analytics — Biman Visitor Operations" },
      { property: "og:description", content: "Measured and estimated visitor dwell time, trends, unmatched events and CSV export." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  pendingComponent: PageSkeleton,
  errorComponent: ({ error }) => <PageError error={error} />,
  component: AnalyticsPage,
});

function StatsBlock({ title, note, b, tone }: { title: string; note: string; b: DwellStatsBlock; tone: string }) {
  return (
    <Panel title={title} meta={<span className="font-mono text-xs text-muted-foreground">{b.count} pairs</span>} className={tone}>
      <div className="grid grid-cols-3 gap-4">
        {([["Average", b.avgSec], ["Maximum", b.maxSec], ["Minimum", b.minSec]] as const).map(([k, v]) => (
          <div key={k}>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
            <div className="font-display text-2xl font-semibold">{formatDuration(v)}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{note}</p>
    </Panel>
  );
}

function AnalyticsPage() {
  const range = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data } = useSuspenseQuery(analyticsQuery(range));
  const s = data.stats;
  const setRange = (p: Partial<typeof range>) => navigate({ to: ".", search: (prev) => ({ ...prev, ...p }) });

  const exportCsv = () => {
    const station = (id: string) => STATIONS.find((x) => x.id === id)?.label ?? id;
    const csv = toCsv(
      ["record_id", "station", "entry_event_id", "exit_event_id", "entry_time_utc", "exit_time_utc", "dwell_minutes", "dwell_kind", "demo_data"],
      data.records.map((r) => [r.id, station(r.stationId), r.entryEventId, r.exitEventId, new Date(r.entryAt).toISOString(), new Date(r.exitAt).toISOString(), (r.durationSec / 60).toFixed(1), r.kind, "yes"]),
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `biman-dwell-${range.from || data.availableRange.from}_${range.to || data.availableRange.to}-DEMO.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const presets = [
    ["Today", 0], ["7 days", 6], ["14 days", 13],
  ] as const;

  return (
    <>
      <PageHeader
        eyebrow="DWL · Analytics"
        title="Dwell Time Analytics"
        description="How long visitors stay, from paired entry and exit detections."
        actions={
          <>
            <DemoTag />
            <button className={ghostBtn} onClick={exportCsv} disabled={data.records.length === 0}><Download className="h-4 w-4" />Export CSV</button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">From
          <input type="date" aria-label="From date" value={range.from} min={data.availableRange.from} max={data.availableRange.to} onChange={(e) => setRange({ from: e.target.value })} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">To
          <input type="date" aria-label="To date" value={range.to} min={data.availableRange.from} max={data.availableRange.to} onChange={(e) => setRange({ to: e.target.value })} className={field} />
        </label>
        {presets.map(([label, days]) => (
          <button key={label} className={ghostBtn} onClick={() => setRange({ from: dhakaDateKey(Date.now() - days * 86_400_000), to: dhakaDateKey(Date.now()) })}>{label}</button>
        ))}
        <button className={ghostBtn} onClick={() => setRange({ from: "", to: "" })}>All</button>
      </div>

      <div className="mb-4 flex gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          <strong>Measured</strong> dwell comes from an entry and exit linked by one continuous tracking session at a station.{" "}
          <strong>Estimated</strong> dwell is a provisional pairing by time order only. The system does not recognise identities, so estimated pairs may not be the same visitor. The two are never combined.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <StatsBlock title="Measured dwell" note="Tracking-session pairs. Reliable for reporting." b={s.measured} tone="border-primary/40" />
        <StatsBlock title="Estimated dwell · provisional" note="Time-order pairs. Use as a rough indication only." b={s.estimated} tone="border-dashed" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[["Entries", s.entries], ["Exits", s.exits], ["Unmatched entries", s.unmatchedEntries], ["Unmatched exits", s.unmatchedExits]].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-border bg-card p-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
            <div className="font-display text-3xl font-semibold tabular-nums">{v}</div>
          </div>
        ))}
      </div>

      {data.records.length === 0 && s.entries === 0 ? (
        <Panel className="mt-4"><EmptyState title="No data in this date range" hint="Demo data covers the last 14 days." /></Panel>
      ) : (
        <>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Panel title="Dwell distribution">
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={data.histogram}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" {...axis} />
                    <YAxis {...axis} width={30} />
                    <Tooltip {...chartTooltip} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="measured" name="Measured" fill="var(--primary)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="estimated" name="Estimated" fill="var(--muted-foreground)" fillOpacity={0.5} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel title="Hourly pattern (Dhaka)">
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={data.hourly}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="hour" {...axis} />
                    <YAxis {...axis} width={30} />
                    <Tooltip {...chartTooltip} labelFormatter={(h) => `${h}:00`} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="entries" name="Entries" fill="var(--entry)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="exits" name="Exits" fill="var(--exit)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>
          <Panel title="Daily trend" className="mt-4">
            <div className="h-72">
              <ResponsiveContainer>
                <ComposedChart data={data.daily.map((d) => ({ ...d, day: d.date.slice(5) }))}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day" {...axis} />
                  <YAxis yAxisId="c" {...axis} width={30} />
                  <YAxis yAxisId="m" orientation="right" {...axis} width={40} unit="m" />
                  <Tooltip {...chartTooltip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="c" dataKey="entries" name="Entries" fill="var(--entry)" fillOpacity={0.7} />
                  <Bar yAxisId="c" dataKey="exits" name="Exits" fill="var(--exit)" fillOpacity={0.7} />
                  <Line yAxisId="m" dataKey="avgMeasuredMin" name="Avg measured dwell (min)" stroke="var(--primary)" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </>
      )}
    </>
  );
}
