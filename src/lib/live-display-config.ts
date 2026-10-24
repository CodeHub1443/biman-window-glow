/**
 * The single place that turns saved Visitor Display settings into the configuration the
 * Visitor Display renders. Used by `/`, `/kiosk` and the Settings preview.
 */
import { displayConfig, type DisplayConfig } from "@/lib/display-config";
import { FALLBACK_IMAGES } from "@/lib/display-images";
import { normalizeDisplaySettings, toDisplayConfig } from "@/lib/settings-logic";

/** `saved` may be missing, partial or corrupted; anything unusable falls back to the built-in default. */
export function resolveDisplayConfig(saved: unknown): DisplayConfig {
  if (saved == null) return displayConfig;
  return toDisplayConfig(displayConfig, normalizeDisplaySettings(saved).settings, FALLBACK_IMAGES);
}
