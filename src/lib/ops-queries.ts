import { queryOptions } from "@tanstack/react-query";
import { mockAnalyticsService, mockEventHistoryService, mockHealthService } from "@/services/operations-service";
import type { DateRange, EventQuery } from "@/types/operations";

// Swap these three for real adapters later; pages only see the query options.
const events = mockEventHistoryService;
const analytics = mockAnalyticsService;
const health = mockHealthService;

export const dashboardQuery = () => queryOptions({ queryKey: ["dashboard"], queryFn: () => analytics.dashboard(), refetchInterval: 30_000 });
export const eventsQuery = (q: EventQuery) => queryOptions({ queryKey: ["events", q], queryFn: () => events.query(q) });
export const eventQuery = (id: string) => queryOptions({ queryKey: ["event", id], queryFn: () => events.get(id) });
export const stationsQuery = () => queryOptions({ queryKey: ["stations"], queryFn: () => events.stations(), staleTime: Infinity });
export const analyticsQuery = (r: DateRange) => queryOptions({ queryKey: ["analytics", r], queryFn: () => analytics.report(r) });
export const healthQuery = () => queryOptions({ queryKey: ["health"], queryFn: () => health.snapshot(), refetchInterval: 5_000 });
