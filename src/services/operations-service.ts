/**
 * Service boundary for operations pages. UI talks to these interfaces only; the real backend
 * adapter will implement the same contracts. Everything here is DEMO data — no hardware, no API.
 */
import face1 from "@/assets/demo-face-1.jpg";
import face2 from "@/assets/demo-face-2.jpg";
import {
  STATIONS, computeDwellStats, dailyCounts, dhakaDateKey, dhakaMidnight, dwellHistogram, filterEvents,
  generateDataset, hourlyCounts, inRange, isMeasured, paginate, sortEvents, type Dataset,
} from "@/lib/ops-data";
import type {
  AnalyticsReport, DashboardSummary, DateRange, DeviceHealth, EventQuery, HealthSnapshot, HealthStatus,
  Paged, Station, StationHealth, VisitorEventRecord,
} from "@/types/operations";

export interface EventHistoryService {
  query(q: EventQuery): Promise<Paged<VisitorEventRecord>>;
  get(id: string): Promise<VisitorEventRecord | null>;
  stations(): Promise<Station[]>;
}
export interface AnalyticsService {
  dashboard(): Promise<DashboardSummary>;
  report(range: DateRange): Promise<AnalyticsReport>;
}
export interface HealthService {
  snapshot(): Promise<HealthSnapshot>;
}

const latency = () => new Promise((r) => setTimeout(r, 200 + Math.random() * 250));

let cache: Dataset | null = null;
const data = () => (cache ??= generateDataset(Date.now(), [face1, face2]));

export const mockEventHistoryService: EventHistoryService = {
  async query(q) {
    await latency();
    return paginate(sortEvents(filterEvents(data().events, q), q.sort, q.dir), q.page, q.pageSize);
  },
  async get(id) {
    await latency();
    return data().events.find((e) => e.id === id) ?? null;
  },
  async stations() {
    return STATIONS;
  },
};

export const mockAnalyticsService: AnalyticsService = {
  async dashboard() {
    await latency();
    const { events, dwell } = data();
    const todayKey = dhakaDateKey(Date.now());
    const todayEvents = events.filter((e) => dhakaDateKey(e.timestamp) === todayKey);
    const entries = todayEvents.filter((e) => e.type === "ENTRY").length;
    const exits = todayEvents.length - entries;
    const measured = dwell.filter((r) => isMeasured(r) && dhakaDateKey(r.entryAt) === todayKey);
    const stats = computeDwellStats(measured, []);
    const weekStart = dhakaMidnight(Date.now()) - 6 * 86_400_000;
    return {
      today: { entries, exits, occupancy: Math.max(0, entries - exits) },
      avgDwellSec: stats.measured.avgSec,
      maxDwellSec: stats.measured.maxSec,
      hourly: hourlyCounts(todayEvents),
      daily: dailyCounts(events.filter((e) => e.timestamp >= weekStart)),
      histogram: dwellHistogram(dwell.filter((r) => r.entryAt >= weekStart)),
      recent: events.slice(-8).reverse(),
    };
  },
  async report(range) {
    await latency();
    const { events, dwell } = data();
    const ev = events.filter((e) => inRange(e.timestamp, range));
    const dw = dwell.filter((r) => inRange(r.entryAt, range));
    const byDay = new Map<string, number[]>();
    for (const r of dw) if (isMeasured(r)) {
      const k = dhakaDateKey(r.entryAt);
      byDay.set(k, [...(byDay.get(k) ?? []), r.durationSec]);
    }
    return {
      stats: computeDwellStats(dw, ev),
      histogram: dwellHistogram(dw),
      hourly: hourlyCounts(ev),
      daily: dailyCounts(ev).map((d) => {
        const v = byDay.get(d.date);
        return { ...d, avgMeasuredMin: v ? Math.round(v.reduce((a, b) => a + b, 0) / v.length / 6) / 10 : null };
      }),
      records: dw,
      availableRange: { from: dhakaDateKey(events[0]?.timestamp ?? Date.now()), to: dhakaDateKey(Date.now()) },
    };
  },
};

const jitter = (base: number, spread: number) => Math.round(base + (Math.random() - 0.5) * spread);

export const mockHealthService: HealthService = {
  async snapshot() {
    await latency();
    const now = Date.now();
    const dev = (d: Omit<DeviceHealth, "lastHeartbeat"> & { lastHeartbeat?: number }): DeviceHealth => ({
      lastHeartbeat: d.status === "offline" ? now - 14 * 60_000 : now - jitter(3000, 4000),
      ...d,
    });
    const stations: StationHealth[] = STATIONS.map((st, i) => {
      const n = i + 1;
      const speakerDown = n === 2; // demonstrates a disconnected device
      return {
        station: st,
        devices: [
          dev({ id: `EDGE-${n}`, kind: "edge", label: `Edge device ${n}`, model: "NVIDIA Jetson", status: "online", port: n * 4 - 3,
            metrics: { cpu: jitter(38 + i * 12, 14), gpu: jitter(52 + i * 8, 18), mem: jitter(61, 8), tempC: jitter(54 + i * 4, 4) } }),
          dev({ id: st.cameras[0]!.id, kind: "camera", label: `${st.cameras[0]!.label}`, model: "PoE IP camera", status: "online", port: n * 4 - 2, detail: "25 fps · 1080p" }),
          dev({ id: st.cameras[1]!.id, kind: "camera", label: `${st.cameras[1]!.label}`, model: "PoE IP camera", status: n === 2 ? "degraded" : "online", port: n * 4 - 1,
            detail: n === 2 ? "Frame drops 6%" : "25 fps · 1080p" }),
          dev({ id: `DISP-${n}`, kind: "display", label: `Visitor display ${n}`, model: "Display monitor", status: "online", detail: "HDMI · 1920×1080" }),
          dev({ id: `SPK-${n}`, kind: "speaker", label: `Speaker set ${n}`, model: "Speaker set", status: speakerDown ? "offline" : "online",
            detail: speakerDown ? "No audio device detected" : "Volume 70%" }),
        ],
        pipeline: { status: "online" as HealthStatus, queueDepth: jitter(1, 2) < 0 ? 0 : jitter(1, 2), eventsLastHour: jitter(18 - i * 6, 6), avgLatencyMs: jitter(180 + i * 40, 60) },
        audio: { status: speakerDown ? "offline" : "online", volume: speakerDown ? 0 : 70, lastPlayed: speakerDown ? null : now - jitter(240_000, 120_000) },
      };
    });
    const portDevices = stations.flatMap((s) => s.devices.filter((d) => d.port));
    const ports = Array.from({ length: 8 }, (_, idx) => {
      const p = idx + 1;
      const d = portDevices.find((x) => x.port === p);
      return d
        ? { port: p, deviceId: d.id, label: d.label, status: d.status, poeWatts: d.kind === "edge" ? jitter(18, 3) : jitter(6, 2), linkMbps: 1000 }
        : { port: p, deviceId: null, label: "Unused", status: "unused" as const, poeWatts: 0, linkMbps: 0 };
    });
    return {
      generatedAt: now,
      stations,
      network: { device: dev({ id: "SW-1", kind: "switch", label: "Central PoE switch", model: "8-port PoE switch", status: "online", detail: "Uplink 1 Gbps" }), ports },
      log: [
        { id: "L1", at: now - 14 * 60_000, severity: "error", source: "SPK-2", message: "Audio output device not found; greeting audio skipped." },
        { id: "L2", at: now - 9 * 60_000, severity: "warning", source: "CAM-2X", message: "Frame drop rate above 5% for 60 s." },
        { id: "L3", at: now - 42 * 60_000, severity: "info", source: "EDGE-1", message: "Detection service restarted after config reload." },
        { id: "L4", at: now - 3 * 3_600_000, severity: "warning", source: "EDGE-2", message: "GPU temperature reached 71 °C." },
        { id: "L5", at: now - 5 * 3_600_000, severity: "info", source: "SW-1", message: "Port 7 link negotiated at 1 Gbps." },
      ],
    };
  },
};
