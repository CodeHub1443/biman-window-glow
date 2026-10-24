import skyDusk from "@/assets/window-sky-dusk.jpg";
import skyWide from "@/assets/window-sky-wide.jpg";
import type { FallbackImageKey } from "@/types/settings";

/** Bundled fallback images selectable in Settings → Visitor Display. */
export const FALLBACK_IMAGES: Record<FallbackImageKey, string> = { "sky-wide": skyWide, "sky-dusk": skyDusk };
export const FALLBACK_LABELS: Record<FallbackImageKey, string> = { "sky-wide": "Daylight sky over clouds (current)", "sky-dusk": "Dusk sky over clouds" };

/** postMessage protocol between Settings and the /display-preview frame (same origin only). */
export type PreviewMessage =
  | { source: "biman-settings"; type: "config"; settings: import("@/types/settings").VisitorDisplaySettings }
  | { source: "biman-settings"; type: "show"; state: "idle" | "entry" | "exit" }
  | { source: "biman-display-preview"; type: "ready" };
