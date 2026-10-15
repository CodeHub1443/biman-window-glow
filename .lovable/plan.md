# Biman Bangladesh Airlines — AI Visitor Greeting (Frontend)

Frontend-only build with mock data, following your spec. Delivered in phases, starting with the airplane-window Visitor Display.

## Phase 1 — Design foundation + Visitor Display
- Theme: dark (midnight green, charcoal, emerald glow) and light (ivory, deep green), switchable, saved per device.
- Fonts: a precise display face (e.g. Space Grotesk) + mono for HUD readouts (JetBrains Mono).
- Logo slot: a single `BimanBrandHeader` using a clearly marked placeholder until you upload the official logo (it will not be recreated). Always visible on every page and display state.
- Visitor Display (inspired by your reference): large vertical rounded cabin window, layered bezel, cabin-wall texture, HUD lines (compass ticks, clock, coordinates, station code) over the view.
  - Idle: `IdleWindowVideo` with configurable MP4/WebM source, autoplay/muted/loop, cover fit, fallback image, no controls. Placeholder clearly labelled.
  - Entry: captured face, WELCOME ABOARD, "Welcome to Biman Bangladesh Airlines", ENTRY tag, time, station; ascending transition.
  - Exit: face, THANK YOU FOR VISITING, goodbye line, EXIT tag; departure-style transition.
  - State machine with queue, duplicate-ID suppression, configurable duration, missing-face fallback, crossfade (no black frames).
  - Kiosk mode route with no navigation or demo controls; exit via a hidden key combo (Shift+Esc) in development.
  - Demo controls (Idle / Simulate Entry / Simulate Exit) in normal mode only. Sample faces labelled "DEMO".

## Phase 2 — App shell + Operations pages
- Aviation navigation rail (collapsible, logo always visible), theme switcher.
- Operations Dashboard: KPIs, entry vs exit chart, hourly activity, dwell distribution, recent events with thumbnails. "Demo data" labels.
- Visitor Events: search, filters (date, type, camera, station), sort, pagination, detail drawer. No identity claims.
- Dwell Time Analytics: avg/max/min, distribution, hourly/daily trends, unmatched counts, measured vs estimated distinction, CSV export.
- System Health: Station 1 and 2 units (2 cameras, edge device, display, speaker each), PoE switch, simulated telemetry, error log. Labelled "Simulated — no hardware connected".

## Phase 3 — Settings workspace
General, Camera Configuration (CRUD, masked RTSP, test, confirm delete), ROI Editor (polygon draw/move/delete points, entry/exit zones, virtual line + direction, saved vs unsaved), Debug Preview (the only live-stream area; manual start/stop, mock stream with FPS/latency, overlays), Greeting & Audio, Detection & Events, Device & Network, Visitor Display Settings (video source, fit, headlines, previews), Access & Audit layouts. Unconnected settings marked as such.

## Technical details
- TanStack routes: `/` (Visitor Display), `/kiosk`, `/dashboard`, `/events`, `/analytics`, `/health`, `/settings/*` sub-routes.
- `src/services/` adapter interfaces (events, cameras, ROI, health, audio, analytics) with `MockEventService` implementations; swapped later for real backend without touching components.
- `src/types/` TypeScript models; config held in a small store persisted to localStorage (mock saves).
- Charts via recharts; shadcn components; all colors as semantic tokens.
- Idle video path set in one config constant (`/videos/idle.mp4`), documented for replacement.
- Generated assets: cinematic sky/wing fallback image, cabin wall texture, a few clearly labelled demo face illustrations.

## Needed from you
- Official Biman logo file (placeholder used until then).
- Idle video (later).
