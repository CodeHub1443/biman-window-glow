/** Typed models for the operations interface. Shared by mock services and the future backend adapter. */
export type EventType = "ENTRY" | "EXIT";
export type ProcessingStatus = "processed" | "pending" | "failed" | "no_face";
export type HealthStatus = "online" | "degraded" | "offline";

export interface Camera {
  id: string;
  label: string;
  role: "entry" | "exit";
  stationId: string;
}

export interface Station {
  id: string;
  label: string;
  cameras: Camera[];
}

export interface VisitorEventRecord {
  id: string;
  type: EventType;
  timestamp: number; // epoch ms
  stationId: string;
  stationLabel: string;
  cameraId: string;
  cameraLabel: string;
  faceImageUrl?: string | undefined;
  status: ProcessingStatus;
  detectionConfidence: number; // 0–1, face detection confidence (not identity)
  processingMs: number;
  isDemo: true;
}

/**
 * A dwell record pairs one entry with one exit.
 * measured  = linked by a continuous tracking session at the station (no identity).
 * estimated = provisional pairing by time order only; not guaranteed to be the same visitor.
 */
export interface DwellRecord {
  id: string;
  stationId: string;
  entryEventId: string;
  exitEventId: string;
  entryAt: number;
  exitAt: number;
  durationSec: number;
  kind: "measured" | "estimated";
}

export interface DateRange {
  from: string; // yyyy-mm-dd (Dhaka), "" = open
  to: string;
}

export interface EventFilters extends DateRange {
  q: string;
  type: string; // "all" | EventType
  station: string; // "all" | station id
  camera: string; // "all" | camera id
  status: string; // "all" | ProcessingStatus
}

export type EventSortKey = "timestamp" | "type" | "station" | "camera" | "status";
export interface EventQuery extends EventFilters {
  sort: EventSortKey;
  dir: "asc" | "desc";
  page: number;
  pageSize: number;
}

export interface Paged<T> {
  items: T[];
  page: number;
  pageCount: number;
  total: number;
}

export interface DwellStatsBlock {
  count: number;
  avgSec: number | null;
  maxSec: number | null;
  minSec: number | null;
}

export interface DwellStats {
  measured: DwellStatsBlock;
  estimated: DwellStatsBlock;
  entries: number;
  exits: number;
  unmatchedEntries: number;
  unmatchedExits: number;
}

export interface DeviceHealth {
  id: string;
  kind: "edge" | "camera" | "display" | "speaker" | "switch";
  label: string;
  model: string;
  status: HealthStatus;
  lastHeartbeat: number;
  port?: number;
  detail?: string;
  metrics?: { cpu: number; gpu: number; mem: number; tempC: number };
}

export interface StationHealth {
  station: Station;
  devices: DeviceHealth[];
  pipeline: { status: HealthStatus; queueDepth: number; eventsLastHour: number; avgLatencyMs: number };
  audio: { status: HealthStatus; volume: number; lastPlayed: number | null };
}

export interface SwitchPort {
  port: number;
  deviceId: string | null;
  label: string;
  status: HealthStatus | "unused";
  poeWatts: number;
  linkMbps: number;
}

export interface HealthLogEntry {
  id: string;
  at: number;
  severity: "info" | "warning" | "error";
  source: string;
  message: string;
}

export interface HealthSnapshot {
  generatedAt: number;
  stations: StationHealth[];
  network: { device: DeviceHealth; ports: SwitchPort[] };
  log: HealthLogEntry[];
}

export interface DashboardSummary {
  today: { entries: number; exits: number; occupancy: number };
  avgDwellSec: number | null;
  maxDwellSec: number | null;
  hourly: { hour: number; entries: number; exits: number }[];
  daily: { date: string; entries: number; exits: number }[];
  histogram: DwellBucket[];
  recent: VisitorEventRecord[];
}

export interface DwellBucket {
  label: string;
  measured: number;
  estimated: number;
}

export interface AnalyticsReport {
  stats: DwellStats;
  histogram: DwellBucket[];
  hourly: { hour: number; entries: number; exits: number }[];
  daily: { date: string; entries: number; exits: number; avgMeasuredMin: number | null }[];
  records: DwellRecord[];
  availableRange: DateRange;
}
