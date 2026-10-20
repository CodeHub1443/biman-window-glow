/**
 * Pure settings logic: defaults, validation, camera list operations, RTSP helpers, ROI geometry,
 * change summaries, debug-preview state machine and Visitor Display mapping. No React, no storage.
 */
import type {
  AudioClip, AuditEntry, CameraConfig, ConnectionTestResult, DetectionSettings, DeviceNetworkSettings,
  FieldErrors, GeneralSettings, GreetingAudioSettings, OperatorAccount, OperatorRole, Point, RoiConfig,
  RoiZone, ValidationResult, VisitorDisplaySettings,
} from "@/types/settings";

/* ------------------------------------------------------------------ generic helpers */

export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

export const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export function getAt(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]), obj);
}

export function setAt<T>(obj: T, path: string, value: unknown): T {
  const keys = path.split(".");
  const root = clone(obj) as Record<string, unknown>;
  let cur: Record<string, unknown> = root;
  keys.slice(0, -1).forEach((k) => {
    cur[k] = cur[k] && typeof cur[k] === "object" ? cur[k] : {};
    cur = cur[k] as Record<string, unknown>;
  });
  cur[keys.at(-1)!] = value;
  return root as T;
}

/** Leaf paths whose values differ. Arrays are compared by index. */
export function changedPaths(a: unknown, b: unknown, prefix = ""): string[] {
  if (deepEqual(a, b)) return [];
  const isObj = (v: unknown) => typeof v === "object" && v !== null;
  if (!isObj(a) || !isObj(b)) return [prefix || "(value)"];
  const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
  return [...keys].flatMap((k) =>
    changedPaths((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], prefix ? `${prefix}.${k}` : k),
  );
}

const SECRET_KEY = /password|secret|token/i;
const show = (v: unknown) => {
  const s = typeof v === "string" ? `"${v}"` : JSON.stringify(v);
  return s === undefined ? "—" : s.length > 40 ? `${s.slice(0, 37)}…` : s;
};

/** Audit-safe change list: secret fields are reported as changed without their values. */
export function summarizeChanges(before: unknown, after: unknown): string[] {
  return changedPaths(before, after).map((p) =>
    SECRET_KEY.test(p) ? `${p}: updated (value hidden)` : `${p}: ${show(getAt(before, p))} → ${show(getAt(after, p))}`,
  );
}

const range = (errors: FieldErrors, path: string, v: number, min: number, max: number, label: string) => {
  if (!Number.isFinite(v) || v < min || v > max) errors[path] = `${label} must be between ${min} and ${max}.`;
};
const text = (errors: FieldErrors, path: string, v: string, min: number, max: number, label: string) => {
  const t = v.trim();
  if (t.length < min) errors[path] = min <= 1 ? `${label} is required.` : `${label} needs at least ${min} characters.`;
  else if (t.length > max) errors[path] = `${label} must be ${max} characters or fewer.`;
};

/* ------------------------------------------------------------------ defaults (demo) */

export const DEMO_STATIONS = [
  { id: "S1", label: "Station 1 · Main Lobby" },
  { id: "S2", label: "Station 2 · Sales Office" },
];

export const PLANNED_CAMERA_COUNT = 4;

export const defaultGeneral = (): GeneralSettings => ({
  systemName: "Biman Visitor Greeting System",
  stations: clone(DEMO_STATIONS),
  timeZone: "Asia/Dhaka",
  dateFormat: "yyyy-MM-dd",
  timeFormat: "24h",
  theme: "dark",
  greetingDurationSec: 7,
  retention: { eventDays: 90, faceImageDays: 30, auditDays: 365, autoPurge: true },
});

const cam = (id: string, n: number, role: "entry" | "exit", stationId: string, location: string): CameraConfig => ({
  id,
  name: `${id} · ${role === "entry" ? "Entry" : "Exit"}`,
  location,
  role,
  stationId,
  enabled: true,
  // 192.0.2.0/24 is a documentation-only address range: these can never reach a real camera.
  rtspUrl: `rtsp://192.0.2.${10 + n}:554/stream1`,
  username: "demo-viewer",
  password: "",
  transport: "tcp",
  timeoutSec: 10,
  reconnect: { enabled: true, intervalSec: 5, maxAttempts: 10 },
});

export const defaultCameras = (): CameraConfig[] => [
  cam("CAM-1E", 1, "entry", "S1", "Main lobby · entrance doors"),
  cam("CAM-1X", 2, "exit", "S1", "Main lobby · exit doors"),
  cam("CAM-2E", 3, "entry", "S2", "Sales office · entrance"),
  cam("CAM-2X", 4, "exit", "S2", "Sales office · exit"),
];

export const defaultRoi = (cameraId: string, role: "entry" | "exit" = "entry"): RoiConfig => ({
  cameraId,
  stillImage: "lobby",
  zones: [
    {
      id: `${cameraId}-Z1`,
      kind: role,
      label: role === "entry" ? "Entry zone" : "Exit zone",
      points: [{ x: 0.36, y: 0.4 }, { x: 0.64, y: 0.4 }, { x: 0.72, y: 0.72 }, { x: 0.28, y: 0.72 }],
    },
  ],
  line: { enabled: true, a: { x: 0.3, y: 0.56 }, b: { x: 0.7, y: 0.56 }, direction: role === "entry" ? "left_to_right" : "right_to_left" },
});

export const AUDIO_CLIPS: AudioClip[] = [
  { id: "welcome-chime", label: "Welcome chime (demo tone)", kind: "welcome", tone: [660, 880, 990] },
  { id: "welcome-soft", label: "Soft welcome (demo tone)", kind: "welcome", tone: [523, 659] },
  { id: "goodbye-chime", label: "Goodbye chime (demo tone)", kind: "goodbye", tone: [990, 880, 660] },
  { id: "goodbye-soft", label: "Soft goodbye (demo tone)", kind: "goodbye", tone: [659, 523] },
  { id: "none", label: "No audio", kind: "welcome", tone: [] },
];

export const defaultAudio = (): GreetingAudioSettings => ({
  welcomeClipId: "welcome-chime",
  goodbyeClipId: "goodbye-chime",
  volume: 70,
  speakers: [{ stationId: "S1", speakerId: "SPK-1" }, { stationId: "S2", speakerId: "SPK-2" }],
  suppressDuplicateAudio: true,
  minGapSec: 3,
  playOnNoFace: true,
});

export const defaultDetection = (): DetectionSettings => ({
  personConfidence: 0.6,
  minFaceSizePx: 80,
  faceQuality: { enabled: true, minScore: 0.5 },
  confirmation: { policy: "consecutive_frames", frames: 3 },
  duplicateCooldownSec: 10,
  processing: { saveFaceSnapshot: true, keepNoFaceEvents: true, maxQueue: 20 },
  greetingDurationSec: 7,
  dwell: { policy: "measured_and_estimated", maxEstimatedWindowMin: 120 },
});

export const defaultDevices = (): DeviceNetworkSettings => ({
  edgeDevices: [{ id: "EDGE-1", label: "Edge device 1 (Jetson)" }, { id: "EDGE-2", label: "Edge device 2 (Jetson)" }],
  assignments: [
    { stationId: "S1", edgeDeviceId: "EDGE-1", entryCameraId: "CAM-1E", exitCameraId: "CAM-1X", displayId: "DISP-1", speakerId: "SPK-1" },
    { stationId: "S2", edgeDeviceId: "EDGE-2", entryCameraId: "CAM-2E", exitCameraId: "CAM-2X", displayId: "DISP-2", speakerId: "SPK-2" },
  ],
  backend: { apiBaseUrl: "", eventStreamUrl: "" },
  requestTimeoutSec: 10,
  retry: { attempts: 3, backoffSec: 2 },
});

export const defaultDisplay = (): VisitorDisplaySettings => ({
  idleVideoMp4: "", // stays empty until a real asset is supplied
  idleVideoWebm: "",
  fallbackImage: "sky-wide",
  fit: "cover",
  greetingDurationMs: 7000,
  entry: { headline: "WELCOME ABOARD", sub: "Welcome to Biman Bangladesh Airlines" },
  exit: { headline: "THANK YOU FOR VISITING", sub: "Have a pleasant journey. We hope to see you again soon." },
  motion: "full",
});

export const defaultOperators = (now: number): OperatorAccount[] => [
  { id: "OP-1", username: "admin.demo", role: "administrator", active: true, lastActiveAt: now - 20 * 60_000 },
  { id: "OP-2", username: "lobby.operator.demo", role: "operator", active: true, lastActiveAt: now - 3 * 3_600_000 },
  { id: "OP-3", username: "viewer.demo", role: "viewer", active: false, lastActiveAt: null },
];

/* ------------------------------------------------------------------ General */

export function validateGeneral(g: GeneralSettings): ValidationResult {
  const errors: FieldErrors = {};
  const warnings: string[] = [];
  text(errors, "systemName", g.systemName, 2, 60, "System name");
  const seen = new Set<string>();
  g.stations.forEach((s, i) => {
    text(errors, `stations.${i}.label`, s.label, 2, 40, `Station ${i + 1} label`);
    const k = s.label.trim().toLowerCase();
    if (k && seen.has(k)) errors[`stations.${i}.label`] = "Station labels must be unique.";
    seen.add(k);
  });
  range(errors, "greetingDurationSec", g.greetingDurationSec, 3, 30, "Greeting duration (s)");
  range(errors, "retention.eventDays", g.retention.eventDays, 1, 3650, "Event retention (days)");
  range(errors, "retention.faceImageDays", g.retention.faceImageDays, 1, 3650, "Face image retention (days)");
  range(errors, "retention.auditDays", g.retention.auditDays, 30, 3650, "Audit retention (days)");
  if (!errors["retention.faceImageDays"] && g.retention.faceImageDays > g.retention.eventDays)
    errors["retention.faceImageDays"] = "Face images cannot be kept longer than their events.";
  if (!g.retention.autoPurge) warnings.push("Automatic purge is off: data would be kept until removed manually.");
  return { errors, warnings };
}

/* ------------------------------------------------------------------ RTSP */

const RTSP_RE = /^(rtsps?):\/\/(?:([^:@/\s]*)(?::([^@/\s]*))?@)?([^:/\s?#@]+)(?::(\d+))?(\/[^\s]*)?$/i;

export interface ParsedRtsp {
  scheme: "rtsp" | "rtsps";
  username: string;
  password: string;
  host: string;
  port: number;
  path: string;
}

export function parseRtspUrl(url: string): ParsedRtsp | null {
  const m = RTSP_RE.exec(url.trim());
  if (!m) return null;
  const scheme = m[1]!.toLowerCase() as "rtsp" | "rtsps";
  return {
    scheme,
    username: decodeURIComponent(m[2] ?? ""),
    password: decodeURIComponent(m[3] ?? ""),
    host: m[4]!,
    port: m[5] ? Number(m[5]) : scheme === "rtsps" ? 322 : 554,
    path: m[6] ?? "/",
  };
}

/** Moves credentials typed into the URL out into separate fields so they are never shown in the URL. */
export function extractCredentials(url: string): { url: string; username: string; password: string; extracted: boolean } {
  const m = RTSP_RE.exec(url.trim());
  if (!m || (!m[2] && !m[3])) return { url, username: "", password: "", extracted: false };
  return {
    url: `${m[1]!.toLowerCase()}://${m[4]}${m[5] ? `:${m[5]}` : ""}${m[6] ?? ""}`,
    username: decodeURIComponent(m[2] ?? ""),
    password: decodeURIComponent(m[3] ?? ""),
    extracted: true,
  };
}

export const MASK = "••••••••";
/** Fixed-length mask: never reveals the length of the secret. */
export const maskSecret = (s: string) => (s ? MASK : "");

/** URL safe for summaries and logs: any embedded password is replaced by the mask. */
export function maskRtspUrl(url: string): string {
  const p = parseRtspUrl(url);
  if (!p) return url.replace(/\/\/([^:@/\s]*):[^@/\s]*@/, `//$1:${MASK}@`);
  const cred = p.username || p.password ? `${p.username}${p.password ? `:${MASK}` : ""}@` : "";
  return `${p.scheme}://${cred}${p.host}:${p.port}${p.path}`;
}

export function validateRtspUrl(url: string, required: boolean): string | null {
  const t = url.trim();
  if (!t) return required ? "RTSP URL is required for an enabled camera." : null;
  if (/\s/.test(t)) return "RTSP URL cannot contain spaces.";
  const p = parseRtspUrl(t);
  if (!p) return "Use the form rtsp://host:port/path.";
  if (p.username || p.password) return "Remove the username and password from the URL; use the credential fields instead.";
  if (p.port < 1 || p.port > 65535) return "Port must be between 1 and 65535.";
  return null;
}

/* ------------------------------------------------------------------ Cameras */

export type CameraInput = CameraConfig & { passwordSet?: boolean };

export function validateCamera(c: CameraInput, all: CameraConfig[], stationIds: string[]): ValidationResult {
  const errors: FieldErrors = {};
  const warnings: string[] = [];
  text(errors, "name", c.name, 2, 40, "Camera name");
  text(errors, "location", c.location, 2, 60, "Location");
  if (all.some((o) => o.id !== c.id && o.name.trim().toLowerCase() === c.name.trim().toLowerCase())) errors.name = "Another camera already uses this name.";
  if (!stationIds.includes(c.stationId)) errors.stationId = "Choose a station.";
  if (c.role !== "entry" && c.role !== "exit") errors.role = "Choose Entry or Exit.";
  const rtsp = validateRtspUrl(c.rtspUrl, c.enabled);
  if (rtsp) errors.rtspUrl = rtsp;
  if (c.username.length > 64) errors.username = "Username must be 64 characters or fewer.";
  if (c.password.length > 128) errors.password = "Password must be 128 characters or fewer.";
  range(errors, "timeoutSec", c.timeoutSec, 1, 60, "Connection timeout (s)");
  range(errors, "reconnect.intervalSec", c.reconnect.intervalSec, 1, 300, "Reconnect interval (s)");
  range(errors, "reconnect.maxAttempts", c.reconnect.maxAttempts, 0, 100, "Reconnect attempts");

  if (!c.rtspUrl.trim()) warnings.push("No RTSP URL: this camera cannot be checked or previewed.");
  if (c.enabled && !c.username.trim()) warnings.push("No username set: most cameras require credentials.");
  if (c.enabled && !c.password && !c.passwordSet) warnings.push("No password set for this camera.");
  if (c.enabled && all.some((o) => o.id !== c.id && o.enabled && o.stationId === c.stationId && o.role === c.role))
    warnings.push(`Another enabled ${c.role} camera is already assigned to this station.`);
  const count = all.some((o) => o.id === c.id) ? all.length : all.length + 1;
  if (count > PLANNED_CAMERA_COUNT) warnings.push(`This exceeds the planned ${PLANNED_CAMERA_COUNT}-camera installation.`);
  return { errors, warnings };
}

export function nextCameraId(all: CameraConfig[], stationId: string, role: "entry" | "exit"): string {
  const base = `CAM-${stationId.replace(/\D/g, "") || "0"}${role === "entry" ? "E" : "X"}`;
  if (!all.some((c) => c.id === base)) return base;
  let n = 2;
  while (all.some((c) => c.id === `${base}${n}`)) n += 1;
  return `${base}${n}`;
}

export function blankCamera(all: CameraConfig[], stationId = "S1", role: "entry" | "exit" = "entry"): CameraConfig {
  return {
    id: nextCameraId(all, stationId, role), name: "", location: "", role, stationId, enabled: true, rtspUrl: "",
    username: "", password: "", transport: "tcp", timeoutSec: 10, reconnect: { enabled: true, intervalSec: 5, maxAttempts: 10 },
  };
}

export function addCamera(list: CameraConfig[], c: CameraConfig): CameraConfig[] {
  if (list.some((o) => o.id === c.id)) throw new Error(`Camera ${c.id} already exists.`);
  return [...list, c];
}
export function updateCamera(list: CameraConfig[], id: string, patch: Partial<CameraConfig>): CameraConfig[] {
  if (!list.some((o) => o.id === id)) throw new Error(`Camera ${id} not found.`);
  return list.map((o) => (o.id === id ? { ...o, ...patch, id } : o));
}
export function removeCamera(list: CameraConfig[], id: string): CameraConfig[] {
  if (!list.some((o) => o.id === id)) throw new Error(`Camera ${id} not found.`);
  return list.filter((o) => o.id !== id);
}

const hash = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);

/**
 * Simulated connection check. It only inspects the configuration; it never opens a socket and never
 * reports "connected". Hosts containing "fail" or ending in ".invalid" demonstrate failures.
 */
export function simulateConnectionTest(c: CameraInput, now: number): ConnectionTestResult {
  const base = { cameraId: c.id, at: now, simulated: true as const };
  const urlErr = validateRtspUrl(c.rtspUrl, true);
  if (urlErr) return { ...base, ok: false, stage: "validation", message: urlErr, latencyMs: null };
  if (!c.enabled) return { ...base, ok: false, stage: "validation", message: "Camera is disabled. Enable it before testing.", latencyMs: null };
  const p = parseRtspUrl(c.rtspUrl)!;
  if (/fail/i.test(p.host) || p.host.endsWith(".invalid"))
    return { ...base, ok: false, stage: "dns", message: `Simulated failure: host "${p.host}" could not be resolved.`, latencyMs: null };
  if (p.port === 9)
    return { ...base, ok: false, stage: "tcp", message: `Simulated failure: no response on port ${p.port} within ${c.timeoutSec}s.`, latencyMs: null };
  const latency = 18 + (hash(c.id + c.rtspUrl) % 60);
  const auth = c.username && (c.password || c.passwordSet) ? "credentials present" : "credentials incomplete";
  return {
    ...base, ok: true, stage: "complete", latencyMs: latency,
    message: `Simulated check passed (${c.transport.toUpperCase()}, ${auth}). No real connection was made.`,
  };
}

/* ------------------------------------------------------------------ ROI geometry & editing */

export const MIN_ZONE_AREA = 0.005; // 0.5% of frame
export const MIN_LINE_LENGTH = 0.05;

const clamp01 = (v: number) => Math.min(1, Math.max(0, Math.round(v * 10000) / 10000));
export const clampPoint = (p: Point): Point => ({ x: clamp01(p.x), y: clamp01(p.y) });

export function polygonArea(pts: Point[]): number {
  let s = 0;
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length]!;
    s += p.x * q.y - q.x * p.y;
  });
  return Math.abs(s) / 2;
}

const orient = (a: Point, b: Point, c: Point) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
export function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b);
  return o1 !== o2 && o3 !== o4 && o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0;
}

export function isSelfIntersecting(pts: Point[]): boolean {
  const n = pts.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue; // adjacent edges share a vertex
      if (segmentsIntersect(pts[i]!, pts[(i + 1) % n]!, pts[j]!, pts[(j + 1) % n]!)) return true;
    }
  }
  return false;
}

export const addPoint = (z: RoiZone, p: Point): RoiZone => ({ ...z, points: [...z.points, clampPoint(p)] });
export const insertPoint = (z: RoiZone, index: number, p: Point): RoiZone => {
  const points = [...z.points];
  points.splice(Math.max(0, Math.min(index, points.length)), 0, clampPoint(p));
  return { ...z, points };
};
export const movePoint = (z: RoiZone, index: number, p: Point): RoiZone => {
  if (index < 0 || index >= z.points.length) return z;
  return { ...z, points: z.points.map((q, i) => (i === index ? clampPoint(p) : q)) };
};
export const deletePoint = (z: RoiZone, index: number): RoiZone =>
  index < 0 || index >= z.points.length ? z : { ...z, points: z.points.filter((_, i) => i !== index) };

export const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export function validateRoi(cfg: RoiConfig, cameraRole?: "entry" | "exit"): ValidationResult {
  const errors: FieldErrors = {};
  const warnings: string[] = [];
  const labels = new Set<string>();
  cfg.zones.forEach((z) => {
    const key = `zones.${z.id}`;
    const pts = z.points;
    if (!z.label.trim()) errors[`${key}.label`] = "Zone name is required.";
    else if (labels.has(z.label.trim().toLowerCase())) errors[`${key}.label`] = "Zone names must be unique.";
    labels.add(z.label.trim().toLowerCase());
    if (pts.length < 3) errors[key] = `${z.label || "Zone"} needs at least 3 points (has ${pts.length}).`;
    else if (pts.some((p) => p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1)) errors[key] = `${z.label} has points outside the frame.`;
    else if (isSelfIntersecting(pts)) errors[key] = `${z.label} crosses over itself. Move points so edges don't intersect.`;
    else if (polygonArea(pts) < MIN_ZONE_AREA) errors[key] = `${z.label} is too small (under 0.5% of the frame).`;
  });
  if (cfg.line.enabled) {
    const len = Math.hypot(cfg.line.b.x - cfg.line.a.x, cfg.line.b.y - cfg.line.a.y);
    if (len < MIN_LINE_LENGTH) errors.line = "Virtual line is too short. Drag its ends further apart.";
  }
  if (cfg.zones.length === 0) warnings.push("No zones defined: the whole frame would be used.");
  if (cameraRole && cfg.zones.length > 0 && !cfg.zones.some((z) => z.kind === cameraRole))
    warnings.push(`This is an ${cameraRole} camera but it has no ${cameraRole} zone.`);
  return { errors, warnings };
}

/* ------------------------------------------------------------------ Audio, detection, devices, display */

export function validateAudio(a: GreetingAudioSettings, clips: AudioClip[] = AUDIO_CLIPS): ValidationResult {
  const errors: FieldErrors = {};
  const warnings: string[] = [];
  if (!clips.some((c) => c.id === a.welcomeClipId)) errors.welcomeClipId = "Choose a welcome sound.";
  if (!clips.some((c) => c.id === a.goodbyeClipId)) errors.goodbyeClipId = "Choose a goodbye sound.";
  range(errors, "volume", a.volume, 0, 100, "Volume");
  range(errors, "minGapSec", a.minGapSec, 0, 600, "Minimum gap (s)");
  if (a.volume === 0) warnings.push("Volume is 0: greetings would be silent.");
  if (a.speakers.some((s) => !s.speakerId)) warnings.push("A station has no speaker assigned.");
  return { errors, warnings };
}

export function validateDetection(d: DetectionSettings): ValidationResult {
  const errors: FieldErrors = {};
  const warnings: string[] = [];
  range(errors, "personConfidence", d.personConfidence, 0.1, 0.99, "Person confidence");
  range(errors, "minFaceSizePx", d.minFaceSizePx, 20, 600, "Minimum face size (px)");
  range(errors, "faceQuality.minScore", d.faceQuality.minScore, 0, 1, "Minimum quality score");
  if (d.confirmation.policy === "consecutive_frames") range(errors, "confirmation.frames", d.confirmation.frames, 2, 30, "Confirmation frames");
  range(errors, "duplicateCooldownSec", d.duplicateCooldownSec, 0, 600, "Duplicate cooldown (s)");
  range(errors, "processing.maxQueue", d.processing.maxQueue, 1, 100, "Display queue size");
  range(errors, "greetingDurationSec", d.greetingDurationSec, 3, 30, "Greeting duration (s)");
  range(errors, "dwell.maxEstimatedWindowMin", d.dwell.maxEstimatedWindowMin, 1, 480, "Estimated pairing window (min)");
  if (d.personConfidence < 0.4) warnings.push("A low confidence threshold may trigger greetings for non-visitors.");
  if (d.duplicateCooldownSec === 0) warnings.push("Duplicate cooldown is 0: one visitor could trigger repeated greetings.");
  return { errors, warnings };
}

const URL_RE = (schemes: string) => new RegExp(`^(${schemes})://[^\\s/:?#]+(:\\d{1,5})?(/[^\\s]*)?$`, "i");
export function validateDevices(d: DeviceNetworkSettings): ValidationResult {
  const errors: FieldErrors = {};
  const warnings: string[] = [];
  d.edgeDevices.forEach((e, i) => text(errors, `edgeDevices.${i}.label`, e.label, 2, 40, "Edge device label"));
  const api = d.backend.apiBaseUrl.trim();
  const ws = d.backend.eventStreamUrl.trim();
  if (api && !URL_RE("https?").test(api)) errors["backend.apiBaseUrl"] = "Use a full URL such as https://host/api.";
  else if (api.startsWith("http://")) warnings.push("Backend API uses http:// — use https:// outside a closed network.");
  if (ws && !URL_RE("wss?").test(ws)) errors["backend.eventStreamUrl"] = "Use a ws:// or wss:// URL.";
  if (!api || !ws) warnings.push("Backend addresses are placeholders; nothing will connect until the backend is integrated.");
  range(errors, "requestTimeoutSec", d.requestTimeoutSec, 1, 120, "Request timeout (s)");
  range(errors, "retry.attempts", d.retry.attempts, 0, 10, "Retry attempts");
  range(errors, "retry.backoffSec", d.retry.backoffSec, 0, 60, "Retry backoff (s)");
  const keys = ["edgeDeviceId", "entryCameraId", "exitCameraId", "displayId", "speakerId"] as const;
  keys.forEach((k) => {
    const used = new Map<string, number>();
    d.assignments.forEach((a, i) => {
      const v = a[k];
      if (!v) return;
      if (used.has(v)) errors[`assignments.${i}.${k}`] = `${v} is already assigned to another station.`;
      used.set(v, i);
    });
  });
  if (d.assignments.some((a) => !a.entryCameraId || !a.exitCameraId)) warnings.push("A station is missing an entry or exit camera.");
  return { errors, warnings };
}

const VIDEO_PATH = (ext: string) => new RegExp(`^(/(?!.*\\.\\.)[\\w\\-./]+|https://[^\\s]+)\\.${ext}$`, "i");
export function validateDisplay(d: VisitorDisplaySettings): ValidationResult {
  const errors: FieldErrors = {};
  const warnings: string[] = [];
  if (d.idleVideoMp4.trim() && !VIDEO_PATH("mp4").test(d.idleVideoMp4.trim()))
    errors.idleVideoMp4 = "Use a site path like /videos/idle.mp4 or an https:// URL ending in .mp4.";
  if (d.idleVideoWebm.trim() && !VIDEO_PATH("webm").test(d.idleVideoWebm.trim()))
    errors.idleVideoWebm = "Use a site path like /videos/idle.webm or an https:// URL ending in .webm.";
  if (!d.idleVideoMp4.trim() && !d.idleVideoWebm.trim()) warnings.push("No idle video set: the fallback image will be shown.");
  range(errors, "greetingDurationMs", d.greetingDurationMs, 3000, 30000, "Greeting duration (ms)");
  text(errors, "entry.headline", d.entry.headline, 1, 40, "Entry headline");
  text(errors, "entry.sub", d.entry.sub, 0, 120, "Entry message");
  text(errors, "exit.headline", d.exit.headline, 1, 40, "Exit headline");
  text(errors, "exit.sub", d.exit.sub, 0, 120, "Exit message");
  return { errors, warnings };
}

/** Maps saved display settings onto the existing Visitor Display configuration shape. */
export function toDisplayConfig<T extends { idleVideo: { fallbackImage: string } }>(
  base: T,
  s: VisitorDisplaySettings,
  images: Record<VisitorDisplaySettings["fallbackImage"], string>,
): T & { motion: VisitorDisplaySettings["motion"] } {
  return {
    ...base,
    idleVideo: {
      ...base.idleVideo,
      mp4: s.idleVideoMp4.trim() || undefined,
      webm: s.idleVideoWebm.trim() || undefined,
      fallbackImage: images[s.fallbackImage] ?? base.idleVideo.fallbackImage,
      fit: s.fit,
    },
    greetingDurationMs: s.greetingDurationMs,
    entry: { ...s.entry },
    exit: { ...s.exit },
    motion: s.motion,
  };
}

/* ------------------------------------------------------------------ Operators */

export const ROLE_PERMISSIONS: Record<OperatorRole, { label: string; can: string[] }> = {
  administrator: { label: "Administrator", can: ["View operations", "Edit all settings", "Manage cameras & credentials", "Open debug preview", "Manage operators", "View audit log"] },
  operator: { label: "Operator", can: ["View operations", "Edit greeting & display", "Open debug preview", "View audit log"] },
  viewer: { label: "Viewer", can: ["View operations"] },
};

/** At least one active administrator must always remain. */
export function validateOperators(list: OperatorAccount[]): string | null {
  if (!list.some((o) => o.active && o.role === "administrator")) return "At least one active administrator must remain.";
  const names = list.map((o) => o.username.trim().toLowerCase());
  if (names.some((n) => !/^[a-z0-9._-]{3,32}$/.test(n))) return "Usernames use 3–32 letters, numbers, dots, dashes or underscores.";
  if (new Set(names).size !== names.length) return "Usernames must be unique.";
  return null;
}

export function auditEntry(section: AuditEntry["section"], action: string, changes: string[], now: number, actor = "admin.demo"): AuditEntry {
  return { id: `AUD-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`, at: now, actor, section, action, changes };
}

/* ------------------------------------------------------------------ Debug preview state machine */

export type PreviewStatus = "idle" | "connecting" | "streaming" | "reconnecting" | "stopped" | "error";
export interface PreviewLog {
  at: number;
  level: "info" | "warning" | "error";
  message: string;
}
export interface PreviewState {
  status: PreviewStatus;
  cameraId: string | null;
  startedAt: number | null;
  fps: number | null;
  latencyMs: number | null;
  attempts: number;
  error: string | null;
  log: PreviewLog[];
}

export type PreviewAction =
  | { type: "start"; cameraId: string; now: number }
  | { type: "connected"; now: number }
  | { type: "failed"; message: string; now: number }
  | { type: "stats"; fps: number; latencyMs: number }
  | { type: "warn"; message: string; now: number }
  | { type: "reconnect"; now: number }
  | { type: "stop"; reason: string; now: number }
  | { type: "select"; cameraId: string | null; now: number };

export const initialPreview: PreviewState = { status: "idle", cameraId: null, startedAt: null, fps: null, latencyMs: null, attempts: 0, error: null, log: [] };
const MAX_LOG = 50;
const log = (s: PreviewState, level: PreviewLog["level"], message: string, at: number) => [{ at, level, message }, ...s.log].slice(0, MAX_LOG);
export const isPreviewActive = (s: PreviewState) => s.status === "connecting" || s.status === "streaming" || s.status === "reconnecting";

export function previewReducer(s: PreviewState, a: PreviewAction): PreviewState {
  switch (a.type) {
    case "select":
      if (a.cameraId === s.cameraId) return s;
      // Switching camera always stops an active preview; it never starts one.
      return { ...initialPreview, cameraId: a.cameraId, log: isPreviewActive(s) ? log(s, "info", "Preview stopped: camera changed.", a.now) : s.log };
    case "start":
      if (isPreviewActive(s)) return s;
      return { ...s, status: "connecting", cameraId: a.cameraId, startedAt: null, fps: null, latencyMs: null, attempts: 1, error: null, log: log(s, "info", `Starting simulated preview for ${a.cameraId}.`, a.now) };
    case "connected":
      if (s.status !== "connecting" && s.status !== "reconnecting") return s;
      return { ...s, status: "streaming", startedAt: a.now, error: null, log: log(s, "info", "Simulated stream running (no real camera).", a.now) };
    case "failed":
      if (!isPreviewActive(s)) return s;
      return { ...s, status: "error", fps: null, latencyMs: null, error: a.message, log: log(s, "error", a.message, a.now) };
    case "stats":
      return s.status === "streaming" ? { ...s, fps: a.fps, latencyMs: a.latencyMs } : s;
    case "warn":
      return isPreviewActive(s) ? { ...s, log: log(s, "warning", a.message, a.now) } : s;
    case "reconnect":
      if (!s.cameraId || s.status === "idle" || s.status === "stopped") return s;
      return { ...s, status: "reconnecting", fps: null, latencyMs: null, error: null, attempts: s.attempts + 1, log: log(s, "info", `Reconnecting (attempt ${s.attempts + 1}).`, a.now) };
    case "stop":
      if (!isPreviewActive(s) && s.status !== "error") return s;
      return { ...s, status: "stopped", fps: null, latencyMs: null, startedAt: null, log: log(s, "info", `Preview stopped: ${a.reason}.`, a.now) };
  }
}
