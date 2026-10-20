import { queryOptions } from "@tanstack/react-query";
import { mockAnalyticsService, mockEventHistoryService, mockHealthService } from "@/services/operations-service";
import { mockSettingsService } from "@/services/settings-service";
import type { DateRange, EventQuery } from "@/types/operations";

// Swap these for real adapters later; pages only see the query options.
const events = mockEventHistoryService;
const analytics = mockAnalyticsService;
const health = mockHealthService;
export const settingsService = mockSettingsService;

export const dashboardQuery = () => queryOptions({ queryKey: ["dashboard"], queryFn: () => analytics.dashboard(), refetchInterval: 30_000 });
export const eventsQuery = (q: EventQuery) => queryOptions({ queryKey: ["events", q], queryFn: () => events.query(q) });
export const eventQuery = (id: string) => queryOptions({ queryKey: ["event", id], queryFn: () => events.get(id) });
export const stationsQuery = () => queryOptions({ queryKey: ["stations"], queryFn: () => events.stations(), staleTime: Infinity });
export const analyticsQuery = (r: DateRange) => queryOptions({ queryKey: ["analytics", r], queryFn: () => analytics.report(r) });
export const healthQuery = () => queryOptions({ queryKey: ["health"], queryFn: () => health.snapshot(), refetchInterval: 5_000 });

// Settings: every key starts with "settings" so one invalidation refreshes all sections after a save.
const s = settingsService;
export const settingsQueries = {
  meta: () => queryOptions({ queryKey: ["settings", "meta"], queryFn: () => s.getMeta() }),
  general: () => queryOptions({ queryKey: ["settings", "general"], queryFn: () => s.getGeneral() }),
  cameras: () => queryOptions({ queryKey: ["settings", "cameras"], queryFn: () => s.listCameras() }),
  roi: (cameraId: string) => queryOptions({ queryKey: ["settings", "roi", cameraId], queryFn: () => s.getRoi(cameraId) }),
  audioClips: () => queryOptions({ queryKey: ["settings", "audio-clips"], queryFn: () => s.listAudioClips(), staleTime: Infinity }),
  audio: () => queryOptions({ queryKey: ["settings", "audio"], queryFn: () => s.getAudio() }),
  detection: () => queryOptions({ queryKey: ["settings", "detection"], queryFn: () => s.getDetection() }),
  devices: () => queryOptions({ queryKey: ["settings", "devices"], queryFn: () => s.getDevices() }),
  display: () => queryOptions({ queryKey: ["settings", "display"], queryFn: () => s.getDisplay() }),
  operators: () => queryOptions({ queryKey: ["settings", "operators"], queryFn: () => s.listOperators() }),
  audit: () => queryOptions({ queryKey: ["settings", "audit"], queryFn: () => s.listAudit() }),
};
