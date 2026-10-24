import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { settingsQueries, settingsService } from "@/lib/ops-queries";
import { resolveDisplayConfig } from "@/lib/live-display-config";

export type DisplayConfigSource = "saved" | "defaults-loading" | "defaults-unavailable";

/**
 * Saved Visitor Display settings for the live screens. Renders the built-in defaults until the
 * saved settings arrive (never a blank window), keeps them if settings are unavailable, and
 * refreshes when settings are saved in this tab or another one.
 */
export function useDisplayConfig() {
  const qc = useQueryClient();
  const { data, status } = useQuery({ ...settingsQueries.display(), retry: 1 });
  useEffect(() => settingsService.onExternalChange(() => void qc.invalidateQueries({ queryKey: ["settings"] })), [qc]);
  const config = useMemo(() => resolveDisplayConfig(status === "success" ? data : null), [data, status]);
  const source: DisplayConfigSource = status === "success" ? "saved" : status === "error" ? "defaults-unavailable" : "defaults-loading";
  return { config, source };
}
