/**
 * Configuration models for the Settings workspace. Shared by the mock settings service and the
 * future backend adapter. Nothing here is UI; the visual editors only read and write these shapes.
 */

export type SettingsSection =
  | "general" | "cameras" | "roi" | "debug" | "audio" | "detection" | "devices" | "display" | "access";

export type ThemePreference = "dark" | "light";

export interface StationLabel {
  id: string; // S1, S2 — fixed station slots for the planned installation
  label: string;
}

export interface GeneralSettings {
  systemName: string;
  stations: StationLabel[];
  timeZone: string;
  dateFormat: "yyyy-MM-dd" | "dd/MM/yyyy" | "dd MMM yyyy";
  timeFormat: "24h" | "12h";
  theme: ThemePreference;
  /** Shared with Visitor Display and Detection — stored once, in VisitorDisplaySettings. */
  greetingDurationSec: number;
  retention: {
    eventDays: number;
    faceImageDays: number;
    auditDays: number;
    autoPurge: boolean;
  };
}

export type RtspTransport = "auto" | "tcp" | "udp" | "http";

export interface CameraConfig {
  id: string;
  name: string;
  location: string;
  role: "entry" | "exit";
  stationId: string;
  enabled: boolean;
  /** RTSP URL without credentials, e.g. rtsp://10.0.1.21:554/stream1 */
  rtspUrl: string;
  username: string;
  /** Write-only in the UI. Never persisted to browser storage; see settings-service. */
  password: string;
  transport: RtspTransport;
  timeoutSec: number;
  reconnect: { enabled: boolean; intervalSec: number; maxAttempts: number };
}

/** Result of a connection check. In this prototype every result is simulated. */
export interface ConnectionTestResult {
  cameraId: string;
  at: number;
  ok: boolean;
  simulated: true;
  stage: "validation" | "dns" | "tcp" | "rtsp" | "complete";
  message: string;
  latencyMs: number | null;
}

/** Normalised point: 0..1 of frame width / height. */
export interface Point {
  x: number;
  y: number;
}

export interface RoiZone {
  id: string;
  kind: "entry" | "exit";
  label: string;
  points: Point[];
}

export interface VirtualLine {
  enabled: boolean;
  a: Point;
  b: Point;
  /** Which side-to-side crossing counts. a_to_b = left of the A→B line to its right. */
  direction: "left_to_right" | "right_to_left" | "both";
}

export type StillImageKey = "lobby" | "grid";

export interface RoiConfig {
  cameraId: string;
  stillImage: StillImageKey;
  zones: RoiZone[];
  line: VirtualLine;
}

export interface AudioClip {
  id: string;
  label: string;
  kind: "welcome" | "goodbye";
  /** Simulated: a short tone pattern played in this browser only. */
  tone: number[];
}

export interface GreetingAudioSettings {
  welcomeClipId: string;
  goodbyeClipId: string;
  volume: number; // 0–100
  speakers: { stationId: string; speakerId: string }[];
  suppressDuplicateAudio: boolean;
  minGapSec: number;
  playOnNoFace: boolean;
}

export interface DetectionSettings {
  personConfidence: number; // 0–1
  minFaceSizePx: number;
  faceQuality: { enabled: boolean; minScore: number };
  confirmation: { policy: "single_frame" | "consecutive_frames" | "line_crossing"; frames: number };
  duplicateCooldownSec: number;
  processing: { saveFaceSnapshot: boolean; keepNoFaceEvents: boolean; maxQueue: number };
  /** Shared with General and Visitor Display. */
  greetingDurationSec: number;
  dwell: { policy: "measured_only" | "measured_and_estimated"; maxEstimatedWindowMin: number };
}

export interface StationAssignment {
  stationId: string;
  edgeDeviceId: string;
  entryCameraId: string;
  exitCameraId: string;
  displayId: string;
  speakerId: string;
}

export interface DeviceNetworkSettings {
  edgeDevices: { id: string; label: string }[];
  assignments: StationAssignment[];
  backend: { apiBaseUrl: string; eventStreamUrl: string };
  requestTimeoutSec: number;
  retry: { attempts: number; backoffSec: number };
}

export type MotionPreference = "full" | "reduced";
export type FallbackImageKey = "sky-wide" | "sky-dusk";

export interface VisitorDisplaySettings {
  idleVideoMp4: string;
  idleVideoWebm: string;
  fallbackImage: FallbackImageKey;
  fit: "cover" | "contain";
  greetingDurationMs: number;
  entry: { headline: string; sub: string };
  exit: { headline: string; sub: string };
  motion: MotionPreference;
}

export type OperatorRole = "administrator" | "operator" | "viewer";

export interface OperatorAccount {
  id: string;
  username: string;
  role: OperatorRole;
  active: boolean;
  lastActiveAt: number | null;
}

export interface AuditEntry {
  id: string;
  at: number;
  actor: string;
  section: SettingsSection | "system";
  action: string;
  /** Human summary of changed fields. Never contains secret values. */
  changes: string[];
}

export interface SettingsMeta {
  lastSavedAt: Partial<Record<SettingsSection, number>>;
}

export interface FieldErrors {
  [path: string]: string;
}

export interface ValidationResult {
  errors: FieldErrors;
  warnings: string[];
}
