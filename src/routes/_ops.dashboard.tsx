import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { axis, chartTooltip, DemoTag, FaceThumb, PageError, PageHeader, PageSkeleton, Panel, StatusPill, TypeTag } from "@/components/ops/ui";
import { dashboardQuery, healthQuery } from "@/lib/ops-queries";
import { formatDuration, formatTime } from "@/lib/ops-data";

export const Route = createFileRoute("/_ops/dashboard")({
  head: () => ({
    meta: [
      { title: "Operations Dashboard — Biman Visitor Operations" },
      { name: "description", content: "Today's visitor entries, exits, occupancy, dwell time and station status." },
      { property: "og:title", content: "Operations Dashboard — Biman Visitor Operations" },
      { property: "og:description", content: "Today's visitor entries, exits, occupancy, dwell time and station status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: ({ context }) => {
    void context.queryClient.ensureQueryData(dashboardQuery());
    void context.queryClient.ensureQueryData(healthQuery());
  },
  pendingComponent: PageSkeleton,
  errorComponent: ({ error }) => <PageError error={error} />,
  component: Dashboard,
});

function Readout({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div className="flex-1 px-6 py-5">
      <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
        <span className={`h-2 w-2 rounded-full ${tone}`} />{label}
      </div>
      <div className="mt-2 font-display text-6xl font-bold tabular-nums leading-none">{value}</div>
    </div>
  );
}

function Ring({ pct }: { pct: number }) {
  const c = 2 * Math.PI * 42;
  return (
    <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90" role="img" aria-label={`System health ${pct}%`}>
      <circle cx="50" cy="50" r="42" fill="none" stroke="var(--muted)" strokeWidth="9" />
      <circle cx="50" cy="50" r="42" fill="none" stroke="var(--primary)" strokeWidth="9" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} />
    </svg>
  );
}

function Dashboard() {
  const { data } = useSuspenseQuery(dashboardQuery());
  const { data: health } = useSuspenseQuery(healthQuery());
  const cams = health.stations.flatMap((s) => s.devices.filter((d) => d.kind === "camera"));
  const all = [...health.stations.flatMap((s) => s.devices), health.network.device];
  const score = Math.round((all.reduce((a, d) => a + (d.status === "online" ? 1 : d.status === "degraded" ? 0.5 : 0), 0) / all.length) * 100);
  const gaugePct = data.avgDwellSec && data.maxDwellSec ? Math.round((data.avgDwellSec / data.maxDwellSec) * 100) : 0;

  return (
    <>
      <PageHeader eyebrow="OPS · Today" title="Operations Dashboard" description="Visitor activity across both stations. All values are generated demo data." actions={<DemoTag />} />

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr_1fr]">
        <section className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-card sm:flex-row sm:divide-x sm:divide-y-0">
          <Readout label="Entries today" value={data.today.entries} tone="bg-entry" />
          <Readout label="Exits today" value={data.today.exits} tone="bg-exit" />
          <Readout label="Est. on site" value={data.today.occupancy} tone="bg-primary" />
        </section>
        <Panel title="Dwell today · measured">
          <div className="font-display text-4xl font-semibold">{formatDuration(data.avgDwellSec)}</div>
          <div className="text-xs text-muted-foreground">average</div>
          <div className="mt-3 h-1.5 rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${gaugePct}%` }} /></div>
          <div className="mt-2 flex justify-between font-mono text-[11px] text-muted-foreground"><span>avg</span><span>max {formatDuration(data.maxDwellSec)}</span></div>
        </Panel>
        <Panel title="System pulse" meta={<DemoTag>Simulated</DemoTag>}>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Ring pct={score} />
              <div className="absolute inset-0 flex items-center justify-center font-display text-2xl font-bold">{score}%</div>
            </div>
            <div className="space-y-1 text-sm">
              <div><span className="font-display text-2xl font-semibold">{cams.filter((c) => c.status !== "offline").length}</span><span className="text-muted-foreground">/{cams.length} cameras</span></div>
              <Link to="/health" className="text-xs text-primary underline-offset-4 hover:underline">View system health</Link>
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[3fr_2fr]">
        <Panel title="Entries vs exits · last 7 days">
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={data.daily.map((d) => ({ ...d, day: d.date.slice(5) }))}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" {...axis} />
                <YAxis {...axis} width={30} />
                <Tooltip {...chartTooltip} />
                <Area dataKey="entries" name="Entries" stroke="var(--entry)" fill="var(--entry)" fillOpacity={0.25} strokeWidth={2} />
                <Area dataKey="exits" name="Exits" stroke="var(--exit)" fill="var(--exit)" fillOpacity={0.15} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Hourly activity · today">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={data.hourly}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="hour" {...axis} tickFormatter={(h) => `${h}`} />
                <YAxis {...axis} width={30} />
                <Tooltip {...chartTooltip} labelFormatter={(h) => `${h}:00`} />
                <Bar dataKey="entries" name="Entries" fill="var(--entry)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="exits" name="Exits" fill="var(--exit)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_3fr_2fr]">
        <Panel title="Dwell distribution · 7 days">
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={data.histogram}>
                <XAxis dataKey="label" {...axis} fontSize={10} />
                <YAxis {...axis} width={28} />
                <Tooltip {...chartTooltip} />
                <Bar dataKey="measured" name="Measured" stackId="a" fill="var(--primary)" />
                <Bar dataKey="estimated" name="Estimated" stackId="a" fill="var(--muted-foreground)" fillOpacity={0.5} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Recent events" meta={<Link to="/events" className="text-xs text-primary hover:underline">All events</Link>}>
          {data.recent.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No events yet today.</div>
          ) : (
            <ul className="divide-y divide-border">
              {data.recent.map((e) => (
                <li key={e.id}>
                  <Link to="/events" search={{ selected: e.id }} className="flex items-center gap-3 py-2 hover:bg-accent/50">
                    <FaceThumb src={e.faceImageUrl} size={34} />
                    <TypeTag type={e.type} />
                    <span className="flex-1 truncate text-sm">{e.stationLabel}</span>
                    <span className="font-mono text-xs text-muted-foreground">{formatTime(e.timestamp)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Stations">
          <div className="space-y-4">
            {health.stations.map((s) => (
              <div key={s.station.id} className="rounded-md border border-border p-3">
                <div className="text-sm font-medium">{s.station.label}</div>
                <ul className="mt-2 space-y-1">
                  {s.devices.filter((d) => d.kind === "camera" || d.kind === "edge").map((d) => (
                    <li key={d.id} className="flex items-center justify-between text-xs"><span className="text-muted-foreground">{d.label}</span><StatusPill status={d.status} /></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
