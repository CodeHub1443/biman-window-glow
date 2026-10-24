import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { act, render, renderHook } from "@testing-library/react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { ThemeProvider, useTheme } from "@/components/ThemeProvider";
import { useSectionForm } from "@/hooks/use-section-form";
import { displayConfig } from "@/lib/display-config";
import {
  addCamera, addPoint, blankCamera, defaultCameras, defaultDisplay, defaultGeneral, defaultRoi, deletePoint, extractCredentials,
  initialPreview, insertPoint, MASK, maskRtspUrl, maskSecret, movePoint, previewReducer, removeCamera, simulateConnectionTest,
  toDisplayConfig, updateCamera, validateCamera, validateDisplay, validateGeneral, validateOperators, validateRoi, validateRtspUrl,
  defaultOperators,
} from "@/lib/settings-logic";
import { routeTree } from "@/routeTree.gen";
import { createMockSettingsService, STORAGE_KEY, type StorageLike } from "@/services/settings-service";
import type { RoiConfig, RoiZone } from "@/types/settings";

const memStorage = (): StorageLike & { dump: () => string } => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k), dump: () => [...m.values()].join("\n") };
};
const svc = (storage = memStorage()) => createMockSettingsService({ storage, latencyMs: 0, now: () => 1_800_000_000_000 });
const STATIONS = ["S1", "S2"];

describe("camera add / edit / delete", () => {
  it("adds, edits and removes cameras in a list", () => {
    const list = defaultCameras();
    const c = { ...blankCamera(list, "S1", "entry"), name: "Lobby entry 2", location: "Side door", rtspUrl: "rtsp://192.0.2.50:554/s" };
    expect(c.id).toBe("CAM-1E2");
    const added = addCamera(list, c);
    expect(added).toHaveLength(5);
    expect(() => addCamera(added, c)).toThrow(/already exists/);
    const edited = updateCamera(added, c.id, { name: "Renamed", id: "HACK" });
    expect(edited.find((x) => x.id === c.id)?.name).toBe("Renamed");
    expect(removeCamera(edited, c.id)).toHaveLength(4);
    expect(() => removeCamera(list, "NOPE")).toThrow(/not found/);
  });

  it("persists create, update and delete through the mock service, cleaning ROI and assignments", async () => {
    const s = svc();
    const cams = await s.listCameras();
    expect(cams).toHaveLength(4);
    const base = { ...blankCamera(cams.map((c) => ({ ...c, password: "" })), "S2", "exit"), name: "Back exit", location: "Rear door", rtspUrl: "rtsp://192.0.2.60:554/x" };
    const { password: _p, ...rest } = base;
    await s.saveCamera({ ...rest, password: "fake-pass" }, "create");
    expect((await s.listCameras()).map((c) => c.id)).toContain(base.id);
    await s.saveCamera({ ...rest, name: "Back exit B", password: null }, "update");
    const after = (await s.listCameras()).find((c) => c.id === base.id)!;
    expect(after.name).toBe("Back exit B");
    expect(after.passwordSet).toBe(true); // null kept the existing password

    await s.saveRoi(defaultRoi("CAM-1E"));
    await s.deleteCamera("CAM-1E");
    expect((await s.listCameras()).some((c) => c.id === "CAM-1E")).toBe(false);
    expect((await s.getDevices()).assignments[0]!.entryCameraId).toBe("");
    await expect(s.saveCamera({ ...rest, id: "CAM-1E", name: "Ghost", password: null }, "update")).rejects.toThrow(/no longer exists/);
  });

  it("rejects invalid cameras and warns on incomplete ones", () => {
    const list = defaultCameras();
    const bad = { ...blankCamera(list), name: "", rtspUrl: "http://x" };
    const r = validateCamera(bad, list, STATIONS);
    expect(r.errors["name"]).toBeDefined();
    expect(r.errors["rtspUrl"]).toBeDefined();
    const incomplete = { ...blankCamera(list, "S1", "entry"), name: "Extra", location: "Door", rtspUrl: "rtsp://192.0.2.9/s" };
    const w = validateCamera(incomplete, list, STATIONS);
    expect(Object.keys(w.errors)).toHaveLength(0);
    expect(w.warnings.join(" ")).toMatch(/password/);
    expect(w.warnings.join(" ")).toMatch(/planned 4-camera/);
    expect(w.warnings.join(" ")).toMatch(/Another enabled entry camera/);
  });
});

describe("RTSP validation and password masking", () => {
  it("validates RTSP URLs", () => {
    expect(validateRtspUrl("rtsp://192.0.2.10:554/stream1", true)).toBeNull();
    expect(validateRtspUrl("rtsps://cam.local/live", true)).toBeNull();
    expect(validateRtspUrl("", true)).toMatch(/required/);
    expect(validateRtspUrl("", false)).toBeNull();
    expect(validateRtspUrl("http://cam/live", true)).toMatch(/rtsp:\/\//);
    expect(validateRtspUrl("rtsp://cam:70000/x", true)).toMatch(/Port/);
    expect(validateRtspUrl("rtsp://admin:secret@cam/x", true)).toMatch(/credential fields/);
    expect(validateRtspUrl("rtsp://cam /x", true)).toMatch(/spaces/);
  });

  it("masks passwords and moves embedded credentials out of the URL", () => {
    expect(maskSecret("short")).toBe(MASK);
    expect(maskSecret("a-much-longer-password")).toBe(MASK);
    expect(maskSecret("")).toBe("");
    const masked = maskRtspUrl("rtsp://admin:hunter2@192.0.2.10:554/s");
    expect(masked).not.toContain("hunter2");
    expect(masked).toContain(MASK);
    const x = extractCredentials("rtsp://admin:hunter2@192.0.2.10:554/s");
    expect(x).toEqual({ url: "rtsp://192.0.2.10:554/s", username: "admin", password: "hunter2", extracted: true });
  });

  it("never writes camera passwords to browser storage or returns them to the UI", async () => {
    const storage = memStorage();
    const s = svc(storage);
    const [c] = await s.listCameras();
    const { passwordSet: _ps, ...rest } = c!;
    await s.saveCamera({ ...rest, password: "fake-Secret-123" }, "update");
    expect(storage.getItem(STORAGE_KEY)).toBeTruthy();
    expect(storage.dump()).not.toContain("fake-Secret-123");
    const back = (await s.listCameras())[0]!;
    expect(back).not.toHaveProperty("password");
    expect(back.passwordSet).toBe(true);
    const audit = JSON.stringify(await s.listAudit());
    expect(audit).not.toContain("fake-Secret-123");
    expect(audit).toContain("password: updated (value hidden)");
  });
});

describe("mock connection failures", () => {
  const cam = { ...defaultCameras()[0]!, passwordSet: true };
  it("fails for invalid, disabled, unresolvable and unreachable cameras", () => {
    expect(simulateConnectionTest({ ...cam, rtspUrl: "" }, 0)).toMatchObject({ ok: false, stage: "validation", simulated: true });
    expect(simulateConnectionTest({ ...cam, enabled: false }, 0)).toMatchObject({ ok: false, stage: "validation" });
    expect(simulateConnectionTest({ ...cam, rtspUrl: "rtsp://cam-fail.local/s" }, 0)).toMatchObject({ ok: false, stage: "dns" });
    expect(simulateConnectionTest({ ...cam, rtspUrl: "rtsp://192.0.2.10:9/s" }, 0)).toMatchObject({ ok: false, stage: "tcp" });
  });
  it("never claims a real connection on success", () => {
    const r = simulateConnectionTest(cam, 0);
    expect(r.ok).toBe(true);
    expect(r.simulated).toBe(true);
    expect(r.message).toMatch(/No real connection was made/);
    expect(r.message).not.toMatch(/\bconnected\b/i);
  });
});

describe("ROI points and validation", () => {
  const zone: RoiZone = { id: "z", kind: "entry", label: "Entry", points: [] };
  it("adds, moves (clamped), inserts and deletes points", () => {
    let z = addPoint(zone, { x: 0.1, y: 0.1 });
    z = addPoint(z, { x: 0.9, y: 0.1 });
    z = addPoint(z, { x: 0.5, y: 0.9 });
    expect(z.points).toHaveLength(3);
    z = movePoint(z, 0, { x: -0.5, y: 1.4 });
    expect(z.points[0]).toEqual({ x: 0, y: 1 });
    z = insertPoint(z, 1, { x: 0.5, y: 0.05 });
    expect(z.points[1]).toEqual({ x: 0.5, y: 0.05 });
    expect(z.points).toHaveLength(4);
    z = deletePoint(z, 1);
    expect(z.points).toHaveLength(3);
    expect(deletePoint(z, 99)).toBe(z);
  });
  it("rejects too few points, self-intersection, tiny zones and short lines", () => {
    const cfg = (points: RoiZone["points"], lineB = { x: 0.7, y: 0.5 }): RoiConfig => ({
      ...defaultRoi("CAM-1E"), zones: [{ ...zone, points }], line: { enabled: true, a: { x: 0.3, y: 0.5 }, b: lineB, direction: "both" },
    });
    expect(validateRoi(defaultRoi("CAM-1E"), "entry").errors).toEqual({});
    expect(validateRoi(cfg([{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }])).errors["zones.z"]).toMatch(/at least 3/);
    const bowtie = [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.9 }, { x: 0.9, y: 0.1 }, { x: 0.1, y: 0.9 }];
    expect(validateRoi(cfg(bowtie)).errors["zones.z"]).toMatch(/crosses over itself/);
    expect(validateRoi(cfg([{ x: 0.1, y: 0.1 }, { x: 0.12, y: 0.1 }, { x: 0.11, y: 0.12 }])).errors["zones.z"]).toMatch(/too small/);
    expect(validateRoi(cfg(defaultRoi("x").zones[0]!.points, { x: 0.31, y: 0.5 })).errors["line"]).toMatch(/too short/);
    expect(validateRoi({ ...defaultRoi("CAM-1X", "exit") }, "entry").warnings.join()).toMatch(/no entry zone/);
  });
});

describe("save, cancel and reset-to-saved", () => {
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
  it("tracks dirty state, resets a field, cancels, and saves only when valid", async () => {
    const s = svc();
    const saved = await s.getGeneral();
    const { result } = renderHook(() => useSectionForm({ saved, validate: validateGeneral, save: s.saveGeneral, label: "General" }), { wrapper });
    expect(result.current.status).toBe("saved");

    act(() => result.current.set("systemName", "Renamed system"));
    act(() => result.current.set("retention.eventDays", 30));
    expect(result.current.dirty).toBe(true);
    expect(result.current.isFieldDirty("systemName")).toBe(true);
    act(() => result.current.resetField("systemName"));
    expect(result.current.draft.systemName).toBe(saved.systemName);
    expect(result.current.isFieldDirty("retention.eventDays")).toBe(true);
    act(() => result.current.cancel());
    expect(result.current.dirty).toBe(false);

    act(() => result.current.set("systemName", "x"));
    let r: string = "";
    await act(async () => { r = await result.current.submit(); });
    expect(r).toBe("invalid");
    expect(result.current.errorFor("systemName")).toMatch(/at least 2/);

    act(() => result.current.set("systemName", "Biman HQ visitors"));
    act(() => result.current.set("retention.autoPurge", false)); // produces a warning
    await act(async () => { r = await result.current.submit(); });
    expect(r).toBe("needs-confirm");
    await act(async () => { r = await result.current.submit({ confirmed: true }); });
    expect(r).toBe("saved");
    expect((await s.getGeneral()).systemName).toBe("Biman HQ visitors");
  });

  it("reports a failed save and keeps the draft", async () => {
    const s = svc();
    const saved = await s.getGeneral();
    const { result } = renderHook(() => useSectionForm({ saved, validate: validateGeneral, save: s.saveGeneral, label: "General" }), { wrapper });
    act(() => result.current.set("systemName", "Will fail"));
    s.failNextSave("Simulated outage");
    let r = "";
    await act(async () => { r = await result.current.submit(); });
    expect(r).toBe("failed");
    expect(result.current.status).toBe("error");
    expect(result.current.draft.systemName).toBe("Will fail");
    expect((await s.getGeneral()).systemName).toBe(saved.systemName);
  });

  it("persists across service instances (page refresh) and shares the greeting duration", async () => {
    const storage = memStorage();
    const a = svc(storage);
    await a.saveGeneral({ ...(await a.getGeneral()), greetingDurationSec: 10 });
    const b = svc(storage);
    expect((await b.getDisplay()).greetingDurationMs).toBe(10_000);
    expect((await b.getDetection()).greetingDurationSec).toBe(10);
  });
});

describe("Visitor Display configuration", () => {
  it("keeps the idle video empty by default and maps settings onto the display config", () => {
    const d = defaultDisplay();
    expect(d.idleVideoMp4).toBe("");
    const cfg = toDisplayConfig(displayConfig, { ...d, fallbackImage: "sky-dusk", motion: "reduced" }, { "sky-wide": "/wide.jpg", "sky-dusk": "/dusk.jpg" });
    expect(cfg.idleVideo.mp4).toBeUndefined();
    expect(cfg.idleVideo.webm).toBeUndefined();
    expect(cfg.idleVideo.fallbackImage).toBe("/dusk.jpg");
    expect(cfg.motion).toBe("reduced");
    expect(cfg.station).toEqual(displayConfig.station);
  });
  it("matches the built-in display defaults so the live screen is unchanged", () => {
    const d = defaultDisplay();
    expect(d.greetingDurationMs).toBe(displayConfig.greetingDurationMs);
    expect(d.entry).toEqual(displayConfig.entry);
    expect(d.exit).toEqual(displayConfig.exit);
    expect(displayConfig.idleVideo.mp4).toBeUndefined();
    expect(displayConfig.motion).toBe("full");
  });
  it("validates video paths, headlines and duration", () => {
    const d = defaultDisplay();
    expect(validateDisplay({ ...d, idleVideoMp4: "/videos/idle.mp4" }).errors).toEqual({});
    expect(validateDisplay({ ...d, idleVideoMp4: "/videos/../secret.mp4" }).errors["idleVideoMp4"]).toBeDefined();
    expect(validateDisplay({ ...d, idleVideoMp4: "/videos/idle.mov" }).errors["idleVideoMp4"]).toBeDefined();
    expect(validateDisplay({ ...d, entry: { ...d.entry, headline: " " } }).errors["entry.headline"]).toBeDefined();
    expect(validateDisplay({ ...d, greetingDurationMs: 1000 }).errors["greetingDurationMs"]).toBeDefined();
  });
});

describe("debug preview start / stop", () => {
  const t = 1000;
  it("never starts on its own and stops on operator action or camera change", () => {
    let s = previewReducer(initialPreview, { type: "select", cameraId: "CAM-1E", now: t });
    expect(s.status).toBe("idle");
    s = previewReducer(s, { type: "start", cameraId: "CAM-1E", now: t });
    expect(s.status).toBe("connecting");
    s = previewReducer(s, { type: "stats", fps: 25, latencyMs: 100 });
    expect(s.fps).toBeNull(); // no stats before streaming
    s = previewReducer(s, { type: "connected", now: t });
    expect(s.status).toBe("streaming");
    s = previewReducer(s, { type: "stats", fps: 25, latencyMs: 100 });
    expect(s.fps).toBe(25);
    s = previewReducer(s, { type: "stop", reason: "stopped by operator", now: t });
    expect(s.status).toBe("stopped");
    expect(s.fps).toBeNull();

    s = previewReducer(previewReducer(s, { type: "start", cameraId: "CAM-1E", now: t }), { type: "connected", now: t });
    s = previewReducer(s, { type: "select", cameraId: "CAM-2E", now: t });
    expect(s.status).toBe("idle");
    expect(s.cameraId).toBe("CAM-2E");
  });
  it("records failures and supports reconnect", () => {
    let s = previewReducer({ ...initialPreview, cameraId: "CAM-1E" }, { type: "start", cameraId: "CAM-1E", now: t });
    s = previewReducer(s, { type: "failed", message: "Simulated failure", now: t });
    expect(s.status).toBe("error");
    expect(s.log[0]?.level).toBe("error");
    s = previewReducer(s, { type: "reconnect", now: t });
    expect(s.status).toBe("reconnecting");
    expect(s.attempts).toBe(2);
  });
});

describe("access rules", () => {
  it("requires at least one active administrator", () => {
    const ops = defaultOperators(0);
    expect(validateOperators(ops)).toBeNull();
    expect(validateOperators(ops.map((o) => (o.role === "administrator" ? { ...o, role: "viewer" as const } : o)))).toMatch(/administrator/);
    expect(validateOperators(ops.map((o) => (o.role === "administrator" ? { ...o, active: false } : o)))).toMatch(/administrator/);
    expect(validateOperators([...ops, { ...ops[1]!, id: "dup" }])).toMatch(/unique/);
  });
});

describe("general settings", () => {
  it("rejects duplicate station labels and face retention longer than events", () => {
    const g = defaultGeneral();
    const r = validateGeneral({ ...g, stations: [g.stations[0]!, { ...g.stations[1]!, label: g.stations[0]!.label }], retention: { ...g.retention, faceImageDays: 200, eventDays: 90 } });
    expect(r.errors["stations.1.label"]).toMatch(/unique/);
    expect(r.errors["retention.faceImageDays"]).toMatch(/longer than their events/);
  });
});

describe("navigation", () => {
  it("resolves every settings section to its own page", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    for (const s of ["general", "cameras", "roi", "debug", "audio", "detection", "devices", "display", "access"]) {
      expect(router.matchRoutes(`/settings/${s}`).at(-1)?.routeId).toBe(`/_ops/settings/${s}`);
    }
    expect(router.matchRoutes("/settings").at(-1)?.routeId).toBe("/_ops/settings/");
  });
});

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) ? [p] : [];
  });

describe("theme compatibility and stream restriction", () => {
  const src = join(process.cwd(), "src");
  const settingsFiles = [...walk(join(src, "components/settings")), ...walk(join(src, "routes")).filter((f) => f.includes("settings"))];

  it("uses semantic theme tokens only in settings screens (no hard-coded colours)", () => {
    const bad = /\b(?:text|bg|border|fill|stroke|ring)-(?:white|black|gray|slate|zinc|neutral|red|green|blue|yellow|emerald|amber)(?:-\d{2,3})?\b|#[0-9a-fA-F]{6}\b/;
    const offenders = settingsFiles.filter((f) => bad.test(readFileSync(f, "utf8")));
    expect(settingsFiles.length).toBeGreaterThan(8);
    expect(offenders).toEqual([]);
  });

  it("switches between dark and light themes", () => {
    let api: ReturnType<typeof useTheme> | null = null;
    function Probe() { api = useTheme(); return null; }
    render(<ThemeProvider><Probe /></ThemeProvider>);
    act(() => api!.setTheme("light"));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    act(() => api!.setTheme("dark"));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("has no <video> element outside the idle video component", () => {
    const files = walk(src).filter((f) => !f.includes("/test/"));
    const withVideo = files.filter((f) => /<video\b/.test(readFileSync(f, "utf8"))).map((f) => f.replace(`${src}/`, ""));
    expect(withVideo).toEqual(["components/IdleWindowVideo.tsx"]);
  });
});
