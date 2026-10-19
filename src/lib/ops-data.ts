/** Pure data logic for operations pages: demo generator, filtering, sorting, paging, dwell stats, CSV. */
import type {
  DateRange,
  DwellBucket,
  DwellRecord,
  DwellStats,
  DwellStatsBlock,
  EventFilters,
  EventSortKey,
  Paged,
  ProcessingStatus,
  Station,
  VisitorEventRecord,
} from "@/types/operations";

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;
const DHAKA_OFFSET = 6 * HOUR; // Asia/Dhaka is UTC+6, no DST

export const dhakaDateKey = (ts: number) => new Date(ts + DHAKA_OFFSET).toISOString().slice(0, 10);
export const dhakaHour = (ts: number) => Math.floor(((ts + DHAKA_OFFSET) % DAY) / HOUR);
export const dhakaMidnight = (ts: number) => Math.floor((ts + DHAKA_OFFSET) / DAY) * DAY - DHAKA_OFFSET;

export const STATIONS: Station[] = [
  {
    id: "S1",
    label: "Station 1 · Main Lobby",
    cameras: [
      { id: "CAM-1E", label: "CAM-1E · Entry", role: "entry", stationId: "S1" },
      { id: "CAM-1X", label: "CAM-1X · Exit", role: "exit", stationId: "S1" },
    ],
  },
  {
    id: "S2",
    label: "Station 2 · Sales Office",
    cameras: [
      { id: "CAM-2E", label: "CAM-2E · Entry", role: "entry", stationId: "S2" },
      { id: "CAM-2X", label: "CAM-2X · Exit", role: "exit", stationId: "S2" },
    ],
  },
];

export function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Relative traffic by Dhaka hour (office hours 08–20).
const HOURLY_PROFILE: Record<number, number> = {
  8: 0.4, 9: 0.9, 10: 1.2, 11: 1.3, 12: 1, 13: 0.8, 14: 1.1, 15: 1.2, 16: 1, 17: 0.8, 18: 0.5, 19: 0.3,
};

export interface Dataset {
  events: VisitorEventRecord[];
  dwell: DwellRecord[];
}

/** Deterministic demo dataset for `days` days ending at `now`. Same inputs ⇒ same output. */
export function generateDataset(now: number, faces: string[], days = 14, seed = 20261017): Dataset {
  const rand = mulberry32(seed);
  const events: VisitorEventRecord[] = [];
  const dwell: DwellRecord[] = [];
  const today = dhakaMidnight(now);
  let n = 0;

  const pickStatus = (): ProcessingStatus => {
    const r = rand();
    return r < 0.9 ? "processed" : r < 0.94 ? "no_face" : r < 0.97 ? "pending" : "failed";
  };
  const mk = (type: "ENTRY" | "EXIT", ts: number, st: Station): VisitorEventRecord => {
    const cam = st.cameras[type === "ENTRY" ? 0 : 1]!;
    const status = pickStatus();
    n += 1;
    return {
      id: `EVT-${dhakaDateKey(ts).replaceAll("-", "")}-${String(n).padStart(5, "0")}`,
      type,
      timestamp: ts,
      stationId: st.id,
      stationLabel: st.label,
      cameraId: cam.id,
      cameraLabel: cam.label,
      faceImageUrl: status === "no_face" || faces.length === 0 ? undefined : faces[Math.floor(rand() * faces.length)],
      status,
      detectionConfidence: status === "no_face" ? 0 : Math.round((0.72 + rand() * 0.27) * 100) / 100,
      processingMs: Math.round(80 + rand() * 260),
      isDemo: true,
    };
  };

  for (let d = days - 1; d >= 0; d--) {
    const dayStart = today - d * DAY;
    const dayScale = 0.7 + rand() * 0.6;
    for (let h = 8; h <= 19; h++) {
      const count = Math.round(6 * HOURLY_PROFILE[h]! * dayScale * (0.6 + rand() * 0.8));
      for (let i = 0; i < count; i++) {
        const st = STATIONS[rand() < 0.62 ? 0 : 1]!;
        const entryAt = dayStart + h * HOUR + Math.floor(rand() * HOUR);
        if (entryAt > now) continue;
        const entry = mk("ENTRY", entryAt, st);
        events.push(entry);
        if (rand() < 0.1) continue; // unmatched entry (exit never detected)
        const durationSec = Math.round(240 + Math.pow(rand(), 1.8) * 6600);
        const exitAt = entryAt + durationSec * 1000;
        if (exitAt > now) continue; // still on site
        const exit = mk("EXIT", exitAt, st);
        events.push(exit);
        dwell.push({
          id: `DW-${entry.id.slice(4)}`,
          stationId: st.id,
          entryEventId: entry.id,
          exitEventId: exit.id,
          entryAt,
          exitAt,
          durationSec,
          kind: rand() < 0.7 ? "measured" : "estimated",
        });
      }
      // occasional exit with no matching entry
      if (rand() < 0.25) {
        const ts = dayStart + h * HOUR + Math.floor(rand() * HOUR);
        if (ts <= now) events.push(mk("EXIT", ts, STATIONS[rand() < 0.5 ? 0 : 1]!));
      }
    }
  }
  events.sort((a, b) => a.timestamp - b.timestamp);
  return { events, dwell };
}

export function inRange(ts: number, range: DateRange) {
  const k = dhakaDateKey(ts);
  return (!range.from || k >= range.from) && (!range.to || k <= range.to);
}

export function filterEvents(events: VisitorEventRecord[], f: EventFilters) {
  const q = f.q.trim().toLowerCase();
  return events.filter(
    (e) =>
      (f.type === "all" || e.type === f.type) &&
      (f.station === "all" || e.stationId === f.station) &&
      (f.camera === "all" || e.cameraId === f.camera) &&
      (f.status === "all" || e.status === f.status) &&
      inRange(e.timestamp, f) &&
      (!q || e.id.toLowerCase().includes(q) || e.cameraLabel.toLowerCase().includes(q) || e.stationLabel.toLowerCase().includes(q)),
  );
}

export function sortEvents(events: VisitorEventRecord[], key: EventSortKey, dir: "asc" | "desc") {
  const val = (e: VisitorEventRecord): string | number =>
    key === "timestamp" ? e.timestamp : key === "type" ? e.type : key === "station" ? e.stationLabel : key === "camera" ? e.cameraId : e.status;
  const m = dir === "asc" ? 1 : -1;
  return [...events].sort((a, b) => {
    const va = val(a), vb = val(b);
    if (va < vb) return -m;
    if (va > vb) return m;
    return (a.timestamp - b.timestamp) * m;
  });
}

export function paginate<T>(items: T[], page: number, pageSize: number): Paged<T> {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const p = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  return { items: items.slice((p - 1) * pageSize, p * pageSize), page: p, pageCount, total: items.length };
}

function block(recs: DwellRecord[]): DwellStatsBlock {
  if (recs.length === 0) return { count: 0, avgSec: null, maxSec: null, minSec: null };
  const d = recs.map((r) => r.durationSec);
  return {
    count: recs.length,
    avgSec: Math.round(d.reduce((a, b) => a + b, 0) / d.length),
    maxSec: Math.max(...d),
    minSec: Math.min(...d),
  };
}

/** Measured and estimated dwell are always reported separately, never blended. */
export function computeDwellStats(dwell: DwellRecord[], events: VisitorEventRecord[]): DwellStats {
  const pairedEntries = new Set(dwell.map((r) => r.entryEventId));
  const pairedExits = new Set(dwell.map((r) => r.exitEventId));
  const entries = events.filter((e) => e.type === "ENTRY");
  const exits = events.filter((e) => e.type === "EXIT");
  return {
    measured: block(dwell.filter((r) => r.kind === "measured")),
    estimated: block(dwell.filter((r) => r.kind === "estimated")),
    entries: entries.length,
    exits: exits.length,
    unmatchedEntries: entries.filter((e) => !pairedEntries.has(e.id)).length,
    unmatchedExits: exits.filter((e) => !pairedExits.has(e.id)).length,
  };
}

const BUCKETS: [string, number, number][] = [
  ["<10m", 0, 600], ["10–20m", 600, 1200], ["20–30m", 1200, 1800], ["30–45m", 1800, 2700],
  ["45–60m", 2700, 3600], ["60–90m", 3600, 5400], ["90m+", 5400, Infinity],
];
export function dwellHistogram(dwell: DwellRecord[]): DwellBucket[] {
  return BUCKETS.map(([label, lo, hi]) => {
    const inB = dwell.filter((r) => r.durationSec >= lo && r.durationSec < hi);
    return { label, measured: inB.filter((r) => r.kind === "measured").length, estimated: inB.filter((r) => r.kind === "estimated").length };
  });
}

export function hourlyCounts(events: VisitorEventRecord[]) {
  const rows = Array.from({ length: 13 }, (_, i) => ({ hour: i + 8, entries: 0, exits: 0 }));
  for (const e of events) {
    const r = rows[dhakaHour(e.timestamp) - 8];
    if (!r) continue;
    if (e.type === "ENTRY") r.entries++;
    else r.exits++;
  }
  return rows;
}

export function dailyCounts(events: VisitorEventRecord[]) {
  const map = new Map<string, { date: string; entries: number; exits: number }>();
  for (const e of events) {
    const k = dhakaDateKey(e.timestamp);
    const r = map.get(k) ?? { date: k, entries: 0, exits: 0 };
    if (e.type === "ENTRY") r.entries++;
    else r.exits++;
    map.set(k, r);
  }
  return [...map.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

type Cell = string | number | null | undefined;
export function toCsv(columns: string[], rows: Cell[][]): string {
  const esc = (v: Cell) => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return [columns, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
}

export function formatDuration(sec: number | null) {
  if (sec == null) return "—";
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : m ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
}

const dtf = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
const tf = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit", hour12: false });
export const formatDateTime = (ts: number) => dtf.format(ts);
export const formatTime = (ts: number) => tf.format(ts);
