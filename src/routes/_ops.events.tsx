import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { DemoTag, EmptyState, FaceThumb, field, ghostBtn, PageError, PageHeader, PageSkeleton, ProcessingBadge, TypeTag } from "@/components/ops/ui";
import { eventQuery, eventsQuery, stationsQuery } from "@/lib/ops-queries";
import { formatDateTime } from "@/lib/ops-data";
import type { EventSortKey } from "@/types/operations";

const PAGE_SIZE = 15;
const SORT_KEYS: EventSortKey[] = ["timestamp", "type", "station", "camera", "status"];

const searchSchema = z.object({
  q: fallback(z.string(), "").default(""),
  type: fallback(z.string(), "all").default("all"),
  station: fallback(z.string(), "all").default("all"),
  camera: fallback(z.string(), "all").default("all"),
  status: fallback(z.string(), "all").default("all"),
  from: fallback(z.string(), "").default(""),
  to: fallback(z.string(), "").default(""),
  sort: fallback(z.string(), "timestamp").default("timestamp"),
  dir: fallback(z.string(), "desc").default("desc"),
  page: fallback(z.number(), 1).default(1),
  selected: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/_ops/events")({
  validateSearch: zodValidator(searchSchema),
  loaderDeps: ({ search: { selected: _s, ...rest } }) => rest,
  loader: ({ context, deps }) => {
    void context.queryClient.ensureQueryData(stationsQuery());
    return context.queryClient.ensureQueryData(eventsQuery(toQuery(deps))).then(() => undefined);
  },
  head: () => ({
    meta: [
      { title: "Visitor Events — Biman Visitor Operations" },
      { name: "description", content: "Searchable history of entry and exit events with captured faces and processing status." },
      { property: "og:title", content: "Visitor Events — Biman Visitor Operations" },
      { property: "og:description", content: "Searchable history of entry and exit events with captured faces and processing status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  pendingComponent: PageSkeleton,
  errorComponent: ({ error }) => <PageError error={error} />,
  component: EventsPage,
});

type Search = z.infer<typeof searchSchema>;
function toQuery(s: Omit<Search, "selected">) {
  return {
    q: s.q.slice(0, 100), type: s.type, station: s.station, camera: s.camera, status: s.status, from: s.from, to: s.to,
    sort: SORT_KEYS.includes(s.sort as EventSortKey) ? (s.sort as EventSortKey) : "timestamp",
    dir: s.dir === "asc" ? ("asc" as const) : ("desc" as const),
    page: Math.max(1, Math.floor(s.page)),
    pageSize: PAGE_SIZE,
  };
}

function EventsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { selected, ...rest } = search;
  const q = toQuery(rest);
  const { data } = useSuspenseQuery(eventsQuery(q));
  const { data: stations } = useSuspenseQuery(stationsQuery());
  const set = (patch: Partial<Search>, resetPage = true) =>
    navigate({ to: ".", search: (prev) => ({ ...prev, ...patch, ...(resetPage ? { page: 1 } : {}) }) });

  // Debounced search box keeps typing smooth while still writing to the URL.
  const [text, setText] = useState(search.q);
  useEffect(() => setText(search.q), [search.q]);
  useEffect(() => {
    if (text === search.q) return;
    const t = setTimeout(() => set({ q: text }), 300);
    return () => clearTimeout(t);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  const cameras = stations.flatMap((s) => s.cameras).filter((c) => search.station === "all" || c.stationId === search.station);
  const filtered = search.q || search.type !== "all" || search.station !== "all" || search.camera !== "all" || search.status !== "all" || search.from || search.to;

  const SortHead = ({ k, label }: { k: EventSortKey; label: string }) => (
    <th scope="col" className="px-3 py-2 text-left">
      <button
        onClick={() => set({ sort: k, dir: q.sort === k && q.dir === "desc" ? "asc" : "desc" }, false)}
        className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
        aria-label={`Sort by ${label}`}
      >
        {label}
        {q.sort === k && (q.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </th>
  );

  return (
    <>
      <PageHeader eyebrow="EVT · History" title="Visitor Events" description="Each row is a single detection. Events are not linked to named people." actions={<DemoTag />} />

      <div className="mb-4 flex flex-wrap items-end gap-2 rounded-lg border border-border bg-card p-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Search
          <input aria-label="Search events" placeholder="Event ID, camera, station" value={text} onChange={(e) => setText(e.target.value)} className={`${field} w-56`} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">From
          <input type="date" aria-label="From date" value={search.from} onChange={(e) => set({ from: e.target.value })} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">To
          <input type="date" aria-label="To date" value={search.to} onChange={(e) => set({ to: e.target.value })} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Type
          <select aria-label="Event type" value={search.type} onChange={(e) => set({ type: e.target.value })} className={field}>
            <option value="all">All</option><option value="ENTRY">Entry</option><option value="EXIT">Exit</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Station
          <select aria-label="Station" value={search.station} onChange={(e) => set({ station: e.target.value, camera: "all" })} className={field}>
            <option value="all">All stations</option>
            {stations.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Camera
          <select aria-label="Camera" value={search.camera} onChange={(e) => set({ camera: e.target.value })} className={field}>
            <option value="all">All cameras</option>
            {cameras.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">Status
          <select aria-label="Processing status" value={search.status} onChange={(e) => set({ status: e.target.value })} className={field}>
            <option value="all">All</option><option value="processed">Processed</option><option value="pending">Pending</option><option value="failed">Failed</option><option value="no_face">No face</option>
          </select>
        </label>
        {filtered && (
          <Link to="/events" className={`${ghostBtn} ml-auto`}><X className="h-4 w-4" />Clear filters</Link>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-border bg-muted/40">
              <tr>
                <th scope="col" className="px-3 py-2 text-left font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Face</th>
                <SortHead k="type" label="Type" />
                <SortHead k="timestamp" label="Time (Dhaka)" />
                <SortHead k="station" label="Station" />
                <SortHead k="camera" label="Camera" />
                <SortHead k="status" label="Processing" />
                <th scope="col" className="px-3 py-2 text-left font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Event ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.items.map((e) => (
                <tr key={e.id} onClick={() => set({ selected: e.id }, false)} className="cursor-pointer hover:bg-accent/50">
                  <td className="px-3 py-2"><FaceThumb src={e.faceImageUrl} size={36} /></td>
                  <td className="px-3 py-2"><TypeTag type={e.type} /></td>
                  <td className="px-3 py-2 font-mono text-xs tabular-nums">{formatDateTime(e.timestamp)}</td>
                  <td className="px-3 py-2">{e.stationLabel}</td>
                  <td className="px-3 py-2 font-mono text-xs">{e.cameraId}</td>
                  <td className="px-3 py-2"><ProcessingBadge status={e.status} /></td>
                  <td className="px-3 py-2">
                    <button onClick={(ev) => { ev.stopPropagation(); set({ selected: e.id }, false); }} className="font-mono text-xs text-primary hover:underline">{e.id}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.total === 0 && <EmptyState title="No events match these filters" hint="Try widening the date range or clearing filters." action={<Link to="/events" className={ghostBtn}>Clear filters</Link>} />}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 text-sm">
          <span className="text-muted-foreground">{data.total} events · page {data.page} of {data.pageCount}</span>
          <div className="flex gap-2">
            <button className={ghostBtn} disabled={data.page <= 1} onClick={() => set({ page: data.page - 1 }, false)}><ChevronLeft className="h-4 w-4" />Previous</button>
            <button className={ghostBtn} disabled={data.page >= data.pageCount} onClick={() => set({ page: data.page + 1 }, false)}>Next<ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      <EventDrawer id={selected} onClose={() => set({ selected: "" }, false)} />
    </>
  );
}

function EventDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: e, isPending, isError } = useQuery({ ...eventQuery(id), enabled: !!id });
  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetTitle>Event detail</SheetTitle>
        <SheetDescription>Single detection record. No identity is attached. <DemoTag className="ml-1" /></SheetDescription>
        {isPending ? (
          <div className="mt-6 h-64 animate-pulse rounded-lg bg-muted" />
        ) : isError || !e ? (
          <div className="mt-6 text-sm text-muted-foreground">Event {id} was not found.</div>
        ) : (
          <div className="mt-6 space-y-5">
            <div className="flex items-center gap-4">
              <FaceThumb src={e.faceImageUrl} size={120} />
              <div className="space-y-2">
                <TypeTag type={e.type} />
                <div className="font-mono text-xs text-muted-foreground">{e.id}</div>
                <ProcessingBadge status={e.status} />
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {[
                ["Time (Dhaka)", formatDateTime(e.timestamp)],
                ["Station", e.stationLabel],
                ["Camera", e.cameraLabel],
                ["Face detection", e.status === "no_face" ? "No face captured" : `${Math.round(e.detectionConfidence * 100)}% confidence`],
                ["Processing time", `${e.processingMs} ms`],
              ].map(([k, v]) => (
                <div key={k}><dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
            <div>
              <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Processing timeline</div>
              <ol className="space-y-2 border-l border-border pl-4 text-sm">
                {[
                  ["Person crossed virtual line", true],
                  ["Face captured", e.status !== "no_face"],
                  ["Greeting shown on display", e.status === "processed" || e.status === "no_face"],
                  ["Event logged", e.status !== "pending"],
                ].map(([label, ok]) => (
                  <li key={String(label)} className="relative">
                    <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ${ok ? "bg-primary" : e.status === "failed" ? "bg-destructive" : "bg-muted-foreground/40"}`} />
                    <span className={ok ? "" : "text-muted-foreground"}>{label}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
