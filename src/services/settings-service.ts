/**
 * Settings service boundary. Pages talk to the SettingsService interface only; a real backend
 * adapter will implement the same contract. This mock persists NON-SECRET configuration to
 * localStorage so it survives navigation and refresh. Camera passwords are held in memory for
 * the current tab only and are never written to browser storage.
 */
import {
  AUDIO_CLIPS, auditEntry, clone, defaultAudio, defaultCameras, defaultDetection, defaultDevices, defaultDisplay,
  defaultGeneral, defaultOperators, defaultRoi, normalizeDisplaySettings, simulateConnectionTest, summarizeChanges, validateAudio,
  validateCamera, validateDetection, validateDevices, validateDisplay, validateGeneral, validateOperators, validateRoi, type CameraInput,
} from "@/lib/settings-logic";
import type {
  AudioClip, AuditEntry, CameraConfig, ConnectionTestResult, DetectionSettings, DeviceNetworkSettings, FieldErrors,
  GeneralSettings, GreetingAudioSettings, OperatorAccount, RoiConfig, SettingsMeta, SettingsSection, ValidationResult,
  VisitorDisplaySettings,
} from "@/types/settings";

/** Camera as returned to the UI: the password is write-only and never sent back. */
export type CameraView = Omit<CameraConfig, "password"> & { passwordSet: boolean };
/** Camera as sent from the UI. password === null means "keep the current password". */
export type CameraSave = Omit<CameraConfig, "password"> & { password: string | null };

export interface DiagnosticCheck {
  id: string;
  label: string;
  result: "pass" | "warn" | "fail" | "skipped";
  detail: string;
}

export interface SettingsService {
  getMeta(): Promise<SettingsMeta>;
  getGeneral(): Promise<GeneralSettings>;
  saveGeneral(v: GeneralSettings): Promise<GeneralSettings>;
  listCameras(): Promise<CameraView[]>;
  saveCamera(v: CameraSave, mode: "create" | "update"): Promise<CameraView>;
  deleteCamera(id: string): Promise<void>;
  setCameraEnabled(id: string, enabled: boolean): Promise<CameraView>;
  testConnection(v: CameraSave): Promise<ConnectionTestResult>;
  getRoi(cameraId: string): Promise<RoiConfig>;
  saveRoi(v: RoiConfig): Promise<RoiConfig>;
  listAudioClips(): Promise<AudioClip[]>;
  getAudio(): Promise<GreetingAudioSettings>;
  saveAudio(v: GreetingAudioSettings): Promise<GreetingAudioSettings>;
  getDetection(): Promise<DetectionSettings>;
  saveDetection(v: DetectionSettings): Promise<DetectionSettings>;
  getDevices(): Promise<DeviceNetworkSettings>;
  saveDevices(v: DeviceNetworkSettings): Promise<DeviceNetworkSettings>;
  runDiagnostics(v: DeviceNetworkSettings): Promise<DiagnosticCheck[]>;
  /** Always resolves to a complete, valid configuration (repaired with defaults where needed). */
  getDisplay(): Promise<VisitorDisplaySettings>;
  saveDisplay(v: VisitorDisplaySettings): Promise<VisitorDisplaySettings>;
  listOperators(): Promise<OperatorAccount[]>;
  saveOperators(v: OperatorAccount[], action: string): Promise<OperatorAccount[]>;
  listAudit(): Promise<AuditEntry[]>;
  resetAll(): Promise<void>;
  /** Notifies when settings were changed elsewhere (another tab now; a server push later). */
  onExternalChange(cb: () => void): () => void;
}

export class SettingsValidationError extends Error {
  constructor(public errors: FieldErrors) {
    super(Object.values(errors)[0] ?? "Some fields are invalid.");
    this.name = "SettingsValidationError";
  }
}

type StoredCamera = Omit<CameraConfig, "password">;
interface Doc {
  version: 1;
  general: Omit<GeneralSettings, "greetingDurationSec">;
  cameras: StoredCamera[];
  roi: Record<string, RoiConfig>;
  audio: GreetingAudioSettings;
  detection: Omit<DetectionSettings, "greetingDurationSec">;
  devices: DeviceNetworkSettings;
  display: VisitorDisplaySettings;
  operators: OperatorAccount[];
  audit: AuditEntry[];
  meta: SettingsMeta;
}

export const STORAGE_KEY = "biman-settings-v1";
const MAX_AUDIT = 200;

const strip = <T extends { password?: unknown }>(c: T): Omit<T, "password"> => {
  const { password: _p, ...rest } = c;
  return rest;
};

function freshDoc(now: number): Doc {
  const { greetingDurationSec: _g, ...general } = defaultGeneral();
  const { greetingDurationSec: _d, ...detection } = defaultDetection();
  return {
    version: 1,
    general,
    cameras: defaultCameras().map(strip),
    roi: {},
    audio: defaultAudio(),
    detection,
    devices: defaultDevices(),
    display: defaultDisplay(),
    operators: defaultOperators(now),
    audit: [auditEntry("system", "Demo configuration created", ["All sections set to illustrative demo defaults."], now, "system")],
    meta: { lastSavedAt: {} },
  };
}

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

const memoryStorage = (): StorageLike => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
};

export function createMockSettingsService(opts: { storage?: StorageLike; latencyMs?: number; now?: () => number } = {}): SettingsService & {
  /** Test hook: the next save rejects as if the backend failed. */
  failNextSave(message?: string): void;
} {
  const storage = opts.storage ?? (typeof window !== "undefined" ? window.localStorage : memoryStorage());
  const now = opts.now ?? Date.now;
  const wait = () => (opts.latencyMs === 0 ? Promise.resolve() : new Promise((r) => setTimeout(r, opts.latencyMs ?? 180 + Math.random() * 180)));
  const passwords = new Map<string, string>(); // in-memory only
  let failNext: string | null = null;
  let cache: Doc | null = null;

  const load = (): Doc => {
    if (cache) return cache;
    const fresh = freshDoc(now());
    try {
      const raw = storage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Partial<Doc> | null) : null;
      if (parsed && typeof parsed === "object" && parsed.version === 1) {
        // Keep each stored section only if it has the expected shape; otherwise use the demo default.
        const merged = { ...fresh } as Record<keyof Doc, unknown>;
        (Object.keys(fresh) as (keyof Doc)[]).forEach((k) => {
          const v = (parsed as Record<string, unknown>)[k];
          const ok = v !== null && typeof v === typeof fresh[k] && Array.isArray(v) === Array.isArray(fresh[k]);
          if (ok) merged[k] = v;
        });
        const doc = merged as unknown as Doc;
        doc.display = normalizeDisplaySettings(doc.display).settings;
        cache = doc;
      } else cache = fresh;
    } catch {
      cache = fresh;
    }
    return cache;
  };
  const persist = (d: Doc) => {
    // Defence in depth: never let a password reach browser storage.
    const safe: Doc = { ...d, cameras: d.cameras.map((c) => strip(c as StoredCamera & { password?: string })) };
    storage.setItem(STORAGE_KEY, JSON.stringify(safe));
    cache = safe;
  };
  const guard = () => {
    if (failNext) {
      const m = failNext;
      failNext = null;
      throw new Error(m);
    }
  };
  const check = (r: ValidationResult) => {
    if (Object.keys(r.errors).length) throw new SettingsValidationError(r.errors);
  };
  const commit = (d: Doc, section: SettingsSection | "system", action: string, changes: string[]) => {
    const at = now();
    d.audit = [auditEntry(section, action, changes.length ? changes : ["No field changes"], at), ...d.audit].slice(0, MAX_AUDIT);
    if (section !== "system") d.meta = { lastSavedAt: { ...d.meta.lastSavedAt, [section]: at } };
    persist(d);
  };
  const view = (c: StoredCamera): CameraView => ({ ...clone(c), passwordSet: Boolean(passwords.get(c.id)) });
  const general = (d: Doc): GeneralSettings => ({ ...clone(d.general), greetingDurationSec: d.display.greetingDurationMs / 1000 });
  const detection = (d: Doc): DetectionSettings => ({ ...clone(d.detection), greetingDurationSec: d.display.greetingDurationMs / 1000 });
  const stationIds = (d: Doc) => d.general.stations.map((s) => s.id);
  const asInput = (v: CameraSave): CameraInput => ({ ...v, password: v.password ?? "", passwordSet: v.password === null ? Boolean(passwords.get(v.id)) : Boolean(v.password) });

  return {
    failNextSave(message = "Simulated save failure. Nothing was changed.") {
      failNext = message;
    },
    onExternalChange(cb) {
      // Another tab saved settings: drop the cached copy so the next read sees the new values.
      if (typeof window === "undefined") return () => {};
      const onStorage = (e: StorageEvent) => {
        if (e.key !== STORAGE_KEY && e.key !== null) return;
        cache = null;
        cb();
      };
      window.addEventListener("storage", onStorage);
      return () => window.removeEventListener("storage", onStorage);
    },
    async getMeta() {
      return clone(load().meta);
    },
    async getGeneral() {
      await wait();
      return general(load());
    },
    async saveGeneral(v) {
      await wait();
      guard();
      check(validateGeneral(v));
      const d = load();
      const before = general(d);
      const { greetingDurationSec, ...rest } = clone(v);
      d.general = rest;
      d.display = { ...d.display, greetingDurationMs: Math.round(greetingDurationSec * 1000) };
      commit(d, "general", "Saved General settings", summarizeChanges(before, v));
      return general(d);
    },
    async listCameras() {
      await wait();
      return load().cameras.map(view);
    },
    async saveCamera(v, mode) {
      await wait();
      guard();
      const d = load();
      const all = d.cameras.map((c) => ({ ...c, password: "" }));
      check(validateCamera(asInput(v), all, stationIds(d)));
      const exists = d.cameras.some((c) => c.id === v.id);
      if (mode === "create" && exists) throw new SettingsValidationError({ id: `Camera ${v.id} already exists.` });
      if (mode === "update" && !exists) throw new Error(`Camera ${v.id} no longer exists.`);
      const before = d.cameras.find((c) => c.id === v.id);
      const stored = strip(v);
      d.cameras = exists ? d.cameras.map((c) => (c.id === v.id ? stored : c)) : [...d.cameras, stored];
      const changes = before ? summarizeChanges(before, stored) : [`Added ${v.id} (${v.role}, station ${v.stationId})`];
      if (v.password !== null && v.password !== (passwords.get(v.id) ?? "")) changes.push("password: updated (value hidden)");
      if (v.password !== null) {
        if (v.password) passwords.set(v.id, v.password);
        else passwords.delete(v.id);
      }
      commit(d, "cameras", mode === "create" ? `Added camera ${v.id}` : `Updated camera ${v.id}`, changes);
      return view(stored);
    },
    async deleteCamera(id) {
      await wait();
      guard();
      const d = load();
      if (!d.cameras.some((c) => c.id === id)) throw new Error(`Camera ${id} not found.`);
      d.cameras = d.cameras.filter((c) => c.id !== id);
      const { [id]: _removed, ...roi } = d.roi;
      d.roi = roi;
      d.devices = {
        ...d.devices,
        assignments: d.devices.assignments.map((a) => ({
          ...a,
          entryCameraId: a.entryCameraId === id ? "" : a.entryCameraId,
          exitCameraId: a.exitCameraId === id ? "" : a.exitCameraId,
        })),
      };
      passwords.delete(id);
      commit(d, "cameras", `Deleted camera ${id}`, [`Removed ${id}, its ROI and station assignment`]);
    },
    async setCameraEnabled(id, enabled) {
      await wait();
      guard();
      const d = load();
      const c = d.cameras.find((x) => x.id === id);
      if (!c) throw new Error(`Camera ${id} not found.`);
      const next = { ...c, enabled };
      d.cameras = d.cameras.map((x) => (x.id === id ? next : x));
      commit(d, "cameras", `${enabled ? "Enabled" : "Disabled"} camera ${id}`, [`enabled: ${!enabled} → ${enabled}`]);
      return view(next);
    },
    async testConnection(v) {
      await new Promise((r) => setTimeout(r, opts.latencyMs === 0 ? 0 : 700));
      return simulateConnectionTest(asInput(v), now());
    },
    async getRoi(cameraId) {
      await wait();
      const d = load();
      const role = d.cameras.find((c) => c.id === cameraId)?.role ?? "entry";
      return clone(d.roi[cameraId] ?? defaultRoi(cameraId, role));
    },
    async saveRoi(v) {
      await wait();
      guard();
      const d = load();
      const camera = d.cameras.find((c) => c.id === v.cameraId);
      if (!camera) throw new Error(`Camera ${v.cameraId} not found.`);
      check(validateRoi(v, camera.role));
      const before = d.roi[v.cameraId] ?? defaultRoi(v.cameraId, camera.role);
      d.roi = { ...d.roi, [v.cameraId]: clone(v) };
      commit(d, "roi", `Saved ROI for ${v.cameraId}`, summarizeChanges(before, v).slice(0, 12));
      return clone(v);
    },
    async listAudioClips() {
      return clone(AUDIO_CLIPS);
    },
    async getAudio() {
      await wait();
      return clone(load().audio);
    },
    async saveAudio(v) {
      await wait();
      guard();
      check(validateAudio(v));
      const d = load();
      const before = d.audio;
      d.audio = clone(v);
      commit(d, "audio", "Saved Greeting & Audio settings", summarizeChanges(before, v));
      return clone(v);
    },
    async getDetection() {
      await wait();
      return detection(load());
    },
    async saveDetection(v) {
      await wait();
      guard();
      check(validateDetection(v));
      const d = load();
      const before = detection(d);
      const { greetingDurationSec, ...rest } = clone(v);
      d.detection = rest;
      d.display = { ...d.display, greetingDurationMs: Math.round(greetingDurationSec * 1000) };
      commit(d, "detection", "Saved Detection & Events settings", summarizeChanges(before, v));
      return detection(d);
    },
    async getDevices() {
      await wait();
      return clone(load().devices);
    },
    async saveDevices(v) {
      await wait();
      guard();
      check(validateDevices(v));
      const d = load();
      const before = d.devices;
      d.devices = clone(v);
      commit(d, "devices", "Saved Device & Network settings", summarizeChanges(before, v));
      return clone(v);
    },
    async runDiagnostics(v) {
      await new Promise((r) => setTimeout(r, opts.latencyMs === 0 ? 0 : 900));
      const d = load();
      const checks: DiagnosticCheck[] = [
        v.backend.apiBaseUrl
          ? { id: "api", label: "Backend API", result: "skipped", detail: "Address saved, but this prototype does not contact servers." }
          : { id: "api", label: "Backend API", result: "warn", detail: "Not configured (placeholder)." },
        v.backend.eventStreamUrl
          ? { id: "ws", label: "Event stream", result: "skipped", detail: "Address saved, but this prototype does not open connections." }
          : { id: "ws", label: "Event stream", result: "warn", detail: "Not configured (placeholder)." },
      ];
      v.assignments.forEach((a) => {
        const label = d.general.stations.find((s) => s.id === a.stationId)?.label ?? a.stationId;
        const missing = (["entryCameraId", "exitCameraId", "edgeDeviceId", "displayId", "speakerId"] as const).filter((k) => !a[k]);
        checks.push({
          id: `assign-${a.stationId}`,
          label: `${label} assignments`,
          result: missing.length ? "fail" : "pass",
          detail: missing.length ? `Missing: ${missing.map((m) => m.replace("Id", "")).join(", ")}` : "All five device slots assigned.",
        });
      });
      checks.push({ id: "spk-2", label: "SPK-2 reachability (simulated)", result: "fail", detail: "Simulated: speaker set 2 reports offline in demo health data." });
      checks.push({ id: "cam-2x", label: "CAM-2X frame rate (simulated)", result: "warn", detail: "Simulated: 6% frame drops in demo health data." });
      return checks;
    },
    async getDisplay() {
      await wait();
      return clone(load().display);
    },
    async saveDisplay(v) {
      await wait();
      guard();
      check(validateDisplay(v));
      const d = load();
      const before = d.display;
      d.display = clone(v);
      commit(d, "display", "Saved Visitor Display settings", summarizeChanges(before, v));
      return clone(v);
    },
    async listOperators() {
      await wait();
      return clone(load().operators);
    },
    async saveOperators(v, action) {
      await wait();
      guard();
      const err = validateOperators(v);
      if (err) throw new SettingsValidationError({ operators: err });
      const d = load();
      const before = d.operators;
      d.operators = clone(v);
      commit(d, "access", action, summarizeChanges(before, v).filter((c) => !c.includes("lastActiveAt")));
      return clone(v);
    },
    async listAudit() {
      await wait();
      return clone(load().audit);
    },
    async resetAll() {
      await wait();
      guard();
      passwords.clear();
      const d = freshDoc(now());
      commit(d, "system", "Reset all settings to demo defaults", ["Every section restored to demo defaults; camera passwords cleared."]);
    },
  };
}

export const mockSettingsService = createMockSettingsService();
