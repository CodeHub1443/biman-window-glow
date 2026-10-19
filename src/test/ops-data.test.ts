import { describe, expect, it } from "vitest";
import { computeDwellStats, dwellCsv, DWELL_CSV_COLUMNS, filterEvents, generateDataset, paginate, sortEvents, toCsv } from "@/lib/ops-data";
import type { DwellRecord, EventFilters, VisitorEventRecord } from "@/types/operations";

const ev = (id: string, type: "ENTRY" | "EXIT", ts: number, stationId = "S1", cameraId = "CAM-1E"): VisitorEventRecord => ({
  id, type, timestamp: ts, stationId, stationLabel: stationId, cameraId, cameraLabel: cameraId, status: "processed",
  detectionConfidence: 0.9, processingMs: 100, isDemo: true,
});
const none: EventFilters = { q: "", type: "all", station: "all", camera: "all", status: "all", from: "", to: "" };
const T = Date.UTC(2026, 9, 17, 6, 0); // 12:00 Dhaka, 17 Oct

describe("event filters", () => {
  const list = [ev("A", "ENTRY", T), ev("B", "EXIT", T + 1000, "S2", "CAM-2X"), ev("C", "ENTRY", T - 86_400_000)];
  it("filters by type", () => expect(filterEvents(list, { ...none, type: "EXIT" }).map((e) => e.id)).toEqual(["B"]));
  it("filters by station", () => expect(filterEvents(list, { ...none, station: "S1" }).map((e) => e.id)).toEqual(["A", "C"]));
  it("filters by Dhaka date range", () => expect(filterEvents(list, { ...none, from: "2026-10-17", to: "2026-10-17" }).map((e) => e.id)).toEqual(["A", "B"]));
  it("searches camera", () => expect(filterEvents(list, { ...none, q: "cam-2x" }).map((e) => e.id)).toEqual(["B"]));
  it("sorts by time both ways", () => {
    expect(sortEvents(list, "timestamp", "asc").map((e) => e.id)).toEqual(["C", "A", "B"]);
    expect(sortEvents(list, "timestamp", "desc").map((e) => e.id)).toEqual(["B", "A", "C"]);
  });
});

describe("pagination", () => {
  it("clamps out-of-range pages", () => {
    const p = paginate([1, 2, 3, 4, 5], 9, 2);
    expect(p).toEqual({ items: [5], page: 3, pageCount: 3, total: 5 });
  });
});

describe("dwell stats", () => {
  const events = [ev("E1", "ENTRY", T), ev("X1", "EXIT", T), ev("E2", "ENTRY", T), ev("X2", "EXIT", T), ev("E3", "ENTRY", T), ev("X9", "EXIT", T)];
  const dw = (id: string, e: string, x: string, sec: number, kind: "measured" | "estimated"): DwellRecord => ({ id, stationId: "S1", entryEventId: e, exitEventId: x, entryAt: T, exitAt: T + sec * 1000, durationSec: sec, kind, trackingSessionId: kind === "measured" ? `TRK-${id}` : null });
  const s = computeDwellStats([dw("D1", "E1", "X1", 600, "measured"), dw("D2", "E2", "X2", 1800, "estimated")], events);
  it("keeps measured and estimated separate", () => {
    expect(s.measured).toEqual({ count: 1, avgSec: 600, maxSec: 600, minSec: 600 });
    expect(s.estimated).toEqual({ count: 1, avgSec: 1800, maxSec: 1800, minSec: 1800 });
  });
  it("counts unmatched entries and exits", () => {
    expect(s.unmatchedEntries).toBe(1);
    expect(s.unmatchedExits).toBe(1);
  });
});

describe("csv", () => {
  it("escapes commas and quotes", () => expect(toCsv(["a", "b"], [["x,y", 'say "hi"']])).toBe('a,b\r\n"x,y","say ""hi"""'));
});

describe("demo generator", () => {
  it("is deterministic and never invents events after now", () => {
    const a = generateDataset(T, ["f"]);
    const b = generateDataset(T, ["f"]);
    expect(a.events.length).toBe(b.events.length);
    expect(a.events.every((e) => e.timestamp <= T && e.isDemo)).toBe(true);
  });
});

describe("measured dwell needs a tracking session", () => {
  const base = { stationId: "S1", entryEventId: "E1", exitEventId: "X1", entryAt: T, exitAt: T + 60_000, durationSec: 60 };
  it("treats a 'measured' record without a session as estimated", () => {
    const s = computeDwellStats([{ ...base, id: "D1", kind: "measured", trackingSessionId: null }], []);
    expect(s.measured.count).toBe(0);
    expect(s.estimated.count).toBe(1);
  });
  it("generated measured records always carry a session", () => {
    const { dwell } = generateDataset(T, ["f"]);
    expect(dwell.filter((r) => r.kind === "measured").every((r) => r.trackingSessionId)).toBe(true);
    expect(dwell.filter((r) => r.kind === "estimated").every((r) => r.trackingSessionId === null)).toBe(true);
  });
});

describe("dwell csv export", () => {
  it("writes one row per given record with the declared columns", () => {
    const rec = { id: "D1", stationId: "S1", entryEventId: "E1", exitEventId: "X1", entryAt: T, exitAt: T + 90_000, durationSec: 90, kind: "estimated" as const, trackingSessionId: null };
    const lines = dwellCsv([rec]).split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(DWELL_CSV_COLUMNS.join(","));
    expect(lines[1]).toBe("D1,Station 1 · Main Lobby (demo placeholder),E1,X1,2026-10-17T06:00:00.000Z,2026-10-17T06:01:30.000Z,1.5,estimated,,yes");
  });
});
