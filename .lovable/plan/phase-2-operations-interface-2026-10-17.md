# Phase 2 — Operations Interface

The approved full-screen Visitor Display (`/`) and `/kiosk` stay untouched. New pages live inside a shared app shell.

## Navigation shell
- Collapsible aviation-style side rail: Visitor Display, Operations Dashboard, Visitor Events, Dwell Time Analytics, System Health, Settings.
- Logo placeholder always visible (rail header, collapsed shows compact mark), theme switch, UTC/Dhaka clock, "DEMO DATA" badge in top bar.
- Mobile: rail becomes a slide-out sheet.
- Visitor Display link opens the existing full-screen page; kiosk stays nav-free.
- Settings: a styled placeholder page ("Coming in Phase 3") so the link works.

## Operations Dashboard (`/dashboard`)
- Hero strip: entries / exits / estimated occupancy in a large flight-board style readout.
- Dwell panel: average and max dwell with a mini gauge.
- System pulse: connected cameras (x/4) and overall health ring.
- Charts: entry vs exit (area), hourly activity (bars), dwell distribution (histogram).
- Recent events list with face thumbnails; station/camera status tiles. No live feeds.

## Visitor Events (`/events`)
- Table: thumbnail, ENTRY/EXIT tag, timestamp, station, camera, processing status (processed, pending, failed, no face).
- Date range, type, station, camera filters; search by event ID/camera; sort by column; pagination; filters kept in the URL.
- Detail drawer with larger face, metadata, processing timeline. No names, no identity linking.

## Dwell Time Analytics (`/analytics`)
- Date range filter; avg/max/min; entry/exit totals.
- Distribution, hourly and daily trend charts.
- Clear split: Measured vs Estimated (provisional matching) with explanatory note; unmatched entries/exits counts.
- CSV export of the filtered dataset.

## System Health (`/health`)
- Station 1 and Station 2 cards: Jetson edge device (heartbeat, CPU/GPU/temp/memory), entry + exit camera, display monitor, speaker set, event processing status.
- Central PoE switch card with per-port status linking to each device.
- Recent error log. Banner: DEMO DATA — NO HARDWARE CONNECTED. One device shown offline to demonstrate disconnected state.

## Shared
- Loading skeletons, empty states ("No events match"), error state with retry, disconnected state.
- Dark and light themes across all pages; semantic tokens only.

## Technical details
- Routes: `_app.tsx`-free; shell as a pathless layout `src/routes/_ops.tsx` (renders `<Outlet />`) with children `_ops.dashboard.tsx`, `_ops.events.tsx`, `_ops.analytics.tsx`, `_ops.health.tsx`, `_ops.settings.tsx`. Each with its own head().
- `src/types/` models: VisitorEventRecord, DwellRecord, Station, Camera, DeviceHealth.
- `src/services/`: `EventHistoryService`, `AnalyticsService`, `HealthService` interfaces + mock implementations (seeded deterministic generator, simulated latency); components use them via TanStack Query.
- Recharts for charts; shadcn sheet/table/select/calendar; CSV built client-side.
- Tests: filter/sort/pagination logic, dwell stats (measured vs estimated), CSV output.
- Verify in browser: all routes, both themes, filters/drawer, CSV download, and that `/` is unchanged.
