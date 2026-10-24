# Backend Integration Readiness

Status: **frontend only.** No backend, camera, speaker or server is connected. Everything below
describes what the frontend currently *expects*, taken from its TypeScript models and mock
services. No backend API description was supplied, so **no endpoint, path, field name or transport
is confirmed**. Each item marked _Confirm_ must be checked against the existing backend before an
adapter is written.

Adapters are swapped in one place each:

| Area | Interface (source of truth) | Mock today | Wiring point |
| --- | --- | --- | --- |
| Live visitor events | `VisitorEventSource` — `src/services/mock-event-service.ts` | `mockEventService` (in-tab + BroadcastChannel) | imported by `/`, `/kiosk` |
| Event history | `EventHistoryService` — `src/services/operations-service.ts` | deterministic demo data | `src/lib/ops-queries.ts` |
| Dashboard / analytics | `AnalyticsService` — same file | derived from demo data | `src/lib/ops-queries.ts` |
| Device health | `HealthService` — same file | simulated statuses | `src/lib/ops-queries.ts` |
| Settings (all 9 sections) | `SettingsService` — `src/services/settings-service.ts` | browser storage (non-secret only) | `src/lib/ops-queries.ts` |

Models: `src/types/operations.ts` (operations) and `src/types/settings.ts` (configuration).

---

## 1. Required operations

Written as the service methods the UI calls. The HTTP/WebSocket shape is the adapter's job.

### Live events (Visitor Display, kiosk)
| Operation | Request | Response |
| --- | --- | --- |
| `subscribe(cb)` | — | stream of `VisitorEvent`; returns an unsubscribe function |

The Settings field `backend.eventStreamUrl` accepts `ws://` / `wss://`. _Confirm_: transport
(WebSocket, SSE, MQTT…), reconnect/backfill rules, and whether events are per station.

### Event history
| Operation | Request | Response |
| --- | --- | --- |
| `query(q)` | `EventQuery` (filters, sort, `page`, `pageSize`) | `Paged<VisitorEventRecord>` |
| `get(id)` | event id | `VisitorEventRecord \| null` |
| `stations()` | — | `Station[]` (with `cameras`) |

Filtering, sorting and pagination currently happen in the browser (`src/lib/ops-data.ts`).
_Confirm_: whether the backend filters/paginates server-side, and its date handling
(the UI uses Dhaka calendar dates `yyyy-mm-dd`, UTC+6).

### Analytics and dashboard
| Operation | Request | Response |
| --- | --- | --- |
| `dashboard()` | — | `DashboardSummary` (polled every 30 s) |
| `report(range)` | `DateRange` | `AnalyticsReport` (stats, histogram, hourly, daily, dwell records) |

_Confirm_: whether aggregates are computed by the backend or from raw events in the adapter.

### Health
| Operation | Request | Response |
| --- | --- | --- |
| `snapshot()` | — | `HealthSnapshot` (polled every 5 s) |

### Settings
Each section has a get/save pair; saves return the stored value and reject with field errors
(`SettingsValidationError { errors: Record<path, message> }`) on invalid input.

| Section | Read | Write | Model |
| --- | --- | --- | --- |
| General | `getGeneral()` | `saveGeneral(v)` | `GeneralSettings` |
| Cameras | `listCameras()` | `saveCamera(v, "create" \| "update")`, `deleteCamera(id)`, `setCameraEnabled(id, on)` | `CameraView` / `CameraSave` |
| Camera test | — | `testConnection(v)` | `ConnectionTestResult` (`simulated: true` today) |
| ROI | `getRoi(cameraId)` | `saveRoi(v)` | `RoiConfig` |
| Audio | `listAudioClips()`, `getAudio()` | `saveAudio(v)` | `AudioClip[]`, `GreetingAudioSettings` |
| Detection | `getDetection()` | `saveDetection(v)` | `DetectionSettings` |
| Devices | `getDevices()` | `saveDevices(v)`, `runDiagnostics(v)` | `DeviceNetworkSettings`, `DiagnosticCheck[]` |
| Visitor Display | `getDisplay()` | `saveDisplay(v)` | `VisitorDisplaySettings` |
| Access | `listOperators()`, `listAudit()` | `saveOperators(list, action)` | `OperatorAccount[]`, `AuditEntry[]` |
| All | `getMeta()`, `onExternalChange(cb)` | `resetAll()` | `SettingsMeta` |

`greetingDurationSec` (General, Detection) and `greetingDurationMs` (Display) are **one stored
value**. _Confirm_: where the backend stores it and in which unit.

---

## 2. Camera and ROI contracts

`CameraConfig` (`src/types/settings.ts`):
- `id`, `name`, `location`, `role: "entry" | "exit"`, `stationId`, `enabled`
- `rtspUrl` — **without credentials** (the UI strips `user:pass@` into separate fields)
- `username`, `password` — password is **write-only**: reads return `passwordSet: boolean` only;
  writes send `password: string` to change, `null` to keep, `""` to clear
- `transport: "auto" | "tcp" | "udp" | "http"`, `timeoutSec`, `reconnect { enabled, intervalSec, maxAttempts }`

`RoiConfig`:
- `cameraId`, `stillImage` (UI-only reference still), `zones: RoiZone[]`, `line: VirtualLine`
- Points are **normalised 0..1** of frame width/height (origin top-left).
- `RoiZone { id, kind: "entry" | "exit", label, points[] }` — at least 3 points, non-self-intersecting, ≥ 0.5 % of frame.
- `VirtualLine { enabled, a, b, direction: "left_to_right" | "right_to_left" | "both" }`.

_Confirm_: the backend's coordinate system (normalised vs pixels, which resolution), zone and line
semantics, the planned count of 4 cameras / 2 stations, and how a real connection test reports stages.

---

## 3. Visitor entry/exit event schema

Live event (`VisitorEvent`, drives the display):
```ts
{ id: string; type: "ENTRY" | "EXIT"; timestamp: string /* ISO 8601 */;
  stationLabel: string; cameraLabel?: string; faceImageUrl?: string; isDemo?: boolean }
```
Display behaviour relies on: unique `id` (duplicates are suppressed, last 500 ids remembered),
FIFO queue (max 20), optional `faceImageUrl` (a "no face" state is shown when absent).

History record (`VisitorEventRecord`):
```ts
{ id; type; timestamp: number /* epoch ms */; stationId; stationLabel; cameraId; cameraLabel;
  faceImageUrl?; status: "processed" | "pending" | "failed" | "no_face";
  detectionConfidence: number /* 0–1, face detection, NOT identity */; processingMs: number }
```
No identity, name or visitor ID exists anywhere in the frontend, and none should be added without a
product decision. _Confirm_: id format and uniqueness scope, timestamp format/time zone, how face
images are served (URL, signed URL, expiry, retention), and the status values the backend emits.

---

## 4. Measured vs estimated dwell

`DwellRecord`:
```ts
{ id; stationId; entryEventId; exitEventId; entryAt; exitAt; durationSec;
  kind: "measured" | "estimated"; trackingSessionId: string | null }
```
- **measured**: entry and exit linked by one continuous tracking session; `trackingSessionId` is required.
  A record without a session id is treated as **estimated**, whatever `kind` says.
- **estimated**: provisional pairing by time order only.
- The two are **never combined** in statistics, charts or exports. `DwellStats` reports them in separate blocks,
  plus `unmatchedEntries` / `unmatchedExits`.

_Confirm_: whether the backend provides tracking-session ids at all, whether it pairs events itself, and the
maximum estimated window (`detection.dwell.maxEstimatedWindowMin`).

---

## 5. Device health and diagnostics

`HealthSnapshot { generatedAt; stations: StationHealth[]; network { device, ports: SwitchPort[] }; log: HealthLogEntry[] }`
- `DeviceHealth { id; kind: "edge" | "camera" | "display" | "speaker" | "switch"; label; model; status: "online" | "degraded" | "offline"; lastHeartbeat; port?; detail?; metrics? { cpu, gpu, mem, tempC } }`
- `StationHealth.pipeline { status, queueDepth, eventsLastHour, avgLatencyMs }`, `.audio { status, volume, lastPlayed }`
- `SwitchPort { port, deviceId | null, label, status | "unused", poeWatts, linkMbps }`

Diagnostics (`runDiagnostics`) return `DiagnosticCheck { id, label, result: "pass" | "warn" | "fail" | "skipped", detail }`.
All current values are simulated (e.g. SPK-2 offline). _Confirm_: heartbeat source and interval, which metrics
the edge devices report, and switch/PoE data availability.

---

## 6. Greeting and audio configuration

`GreetingAudioSettings { welcomeClipId; goodbyeClipId; volume 0–100; speakers: { stationId, speakerId }[]; suppressDuplicateAudio; minGapSec; playOnNoFace }`
`AudioClip { id; label; kind: "welcome" | "goodbye" }` — the `tone` field is a browser-only demo sound and should
be replaced by a real asset reference.

`VisitorDisplaySettings { idleVideoMp4; idleVideoWebm; fallbackImage: "sky-wide" | "sky-dusk"; fit; greetingDurationMs; entry { headline, sub }; exit { headline, sub }; motion }`
— now drives `/` and `/kiosk`. Invalid or missing fields fall back to built-in defaults field by field.

_Confirm_: whether audio plays on the edge device or the display browser, how clips are uploaded/stored, and
whether the backend or the display decides duplicate suppression.

---

## 7. Authentication and authorisation (future)

Nothing is enforced today; operator accounts and roles are demo records.
Requirements for the real implementation:
- Operators sign in before any operations or Settings page; `/` and `/kiosk` need a separate,
  non-interactive device credential (no admin navigation on the kiosk).
- Roles as modelled in `ROLE_PERMISSIONS` (`administrator`, `operator`, `viewer`) must be enforced **by the backend**;
  hiding UI is not security.
- Camera passwords must live in a server-side secret store; the browser must never receive them.
- Every settings save must be written to the audit log server-side (actor, section, changed fields, never secret values).
- At least one active administrator must always remain.

_Confirm_: identity provider, session/token type, device enrolment for kiosks, and role names.

---

## 8. Unresolved assumptions

1. Backend base URL, transport and every endpoint path — none supplied.
2. Real station and camera names and ids (current values are demo placeholders).
3. Detection thresholds and confirmation policies the real pipeline supports (current values are illustrative).
4. Time zone and timestamp format of backend data (UI assumes Dhaka, UTC+6).
5. Face image hosting, retention and privacy rules.
6. Availability of tracking-session ids for measured dwell.
7. Whether display settings are per station/display or global (today: one global configuration).
8. Official logo and idle video assets (placeholders until supplied).
