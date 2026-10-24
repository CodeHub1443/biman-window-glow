import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider } from "@/components/ThemeProvider";
import { displayConfig } from "@/lib/display-config";
import { FALLBACK_IMAGES } from "@/lib/display-images";
import { resolveDisplayConfig } from "@/lib/live-display-config";
import { defaultDisplay, normalizeDisplaySettings } from "@/lib/settings-logic";
import { mockEventService } from "@/services/mock-event-service";
import { createMockSettingsService, STORAGE_KEY, type StorageLike } from "@/services/settings-service";
import type { VisitorDisplaySettings } from "@/types/settings";

// The live routes use Link/useNavigate; render their components without a full router.
vi.mock("@tanstack/react-router", async (orig) => {
  const actual = await orig<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({ children, to, ...rest }: { children: ReactNode; to: string }) => <a href={to} {...rest}>{children}</a>,
    useNavigate: () => () => {},
  };
});

const { Route: IndexRoute } = await import("@/routes/index");
const { Route: KioskRoute } = await import("@/routes/kiosk");
const SCREENS = [
  ["/", IndexRoute.options.component as ComponentType],
  ["/kiosk", KioskRoute.options.component as ComponentType],
] as const;

const memStorage = (): StorageLike => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
};

/** Simulates what the Settings page leaves in browser storage, then tells the app it changed. */
function storeRaw(raw: string | null) {
  if (raw === null) window.localStorage.removeItem(STORAGE_KEY);
  else window.localStorage.setItem(STORAGE_KEY, raw);
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
}
const storeDisplay = (display: unknown) => storeRaw(JSON.stringify({ version: 1, display }));

function renderScreen(Screen: ComponentType) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ThemeProvider>
        <Screen />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}
const backdrop = (c: HTMLElement) => c.querySelector<HTMLImageElement>("img.absolute.inset-0");

const SAVED: VisitorDisplaySettings = {
  ...defaultDisplay(),
  fallbackImage: "sky-dusk",
  fit: "contain",
  motion: "reduced",
  entry: { headline: "SAVED ENTRY HEADLINE", sub: "Saved entry message" },
  exit: { headline: "SAVED EXIT HEADLINE", sub: "Saved exit message" },
};

beforeEach(() => storeRaw(null));
afterEach(() => cleanup());

describe("saved display settings drive the live screens", () => {
  for (const [path, Screen] of SCREENS) {
    it(`${path} shows the built-in defaults when nothing is saved`, async () => {
      const { container } = renderScreen(Screen);
      await waitFor(() => expect(backdrop(container)).not.toBeNull());
      expect(backdrop(container)!.getAttribute("src")).toBe(FALLBACK_IMAGES["sky-wide"]);
      expect(backdrop(container)!.className).toContain("object-cover");
      expect(backdrop(container)!.className).toContain("animate-drift");
      expect(container.querySelector("video")).toBeNull(); // no idle video configured, no live stream
    });

    it(`${path} applies saved background, fit, motion and headlines`, async () => {
      storeDisplay(SAVED);
      const { container, findByText } = renderScreen(Screen);
      await waitFor(() => expect(backdrop(container)?.getAttribute("src")).toBe(FALLBACK_IMAGES["sky-dusk"]), { timeout: 2000 });
      expect(backdrop(container)!.className).toContain("object-contain");
      expect(backdrop(container)!.className).not.toContain("animate-drift");
      act(() => mockEventService.emit(mockEventService.createDemoEvent("ENTRY")));
      expect(await findByText("SAVED ENTRY HEADLINE")).toBeInTheDocument();
      expect(container.querySelector("video")).toBeNull();
    });

    it(`${path} falls back to defaults when saved settings are corrupted`, async () => {
      storeRaw("{not json");
      const { container } = renderScreen(Screen);
      await waitFor(() => expect(backdrop(container)?.getAttribute("src")).toBe(FALLBACK_IMAGES["sky-wide"]), { timeout: 2000 });
      act(() => mockEventService.emit(mockEventService.createDemoEvent("EXIT")));
      await waitFor(() => expect(container.textContent).toContain(displayConfig.exit.headline));
    });

    it(`${path} updates an open screen when settings are saved elsewhere (refresh)`, async () => {
      const { container } = renderScreen(Screen);
      await waitFor(() => expect(backdrop(container)?.getAttribute("src")).toBe(FALLBACK_IMAGES["sky-wide"]), { timeout: 2000 });
      act(() => storeDisplay({ ...defaultDisplay(), fallbackImage: "sky-dusk" }));
      await waitFor(() => expect(backdrop(container)?.getAttribute("src")).toBe(FALLBACK_IMAGES["sky-dusk"]), { timeout: 2000 });
    });
  }
});

describe("display settings normalisation", () => {
  it("returns the built-in defaults for missing settings", () => {
    expect(resolveDisplayConfig(undefined)).toBe(displayConfig);
    expect(normalizeDisplaySettings(null).settings).toEqual(defaultDisplay());
    expect(normalizeDisplaySettings("garbage").settings).toEqual(defaultDisplay());
  });

  it("repairs only the invalid fields and keeps the valid ones", () => {
    const { settings, repaired } = normalizeDisplaySettings({
      ...SAVED,
      fallbackImage: "does-not-exist",
      greetingDurationMs: 5,
      idleVideoMp4: "/videos/../secret.mp4",
      entry: { headline: "X".repeat(41) },
      fit: 42,
    });
    const def = defaultDisplay();
    expect(settings.fallbackImage).toBe(def.fallbackImage);
    expect(settings.greetingDurationMs).toBe(def.greetingDurationMs);
    expect(settings.idleVideoMp4).toBe("");
    expect(settings.entry.headline).toBe(def.entry.headline);
    expect(settings.entry.sub).toBe(def.entry.sub);
    expect(settings.fit).toBe(def.fit);
    expect(settings.motion).toBe("reduced");
    expect(settings.exit).toEqual(SAVED.exit);
    expect(repaired).toEqual(expect.arrayContaining(["fallbackImage", "greetingDurationMs", "idleVideoMp4", "entry.headline", "entry.sub", "fit"]));
  });

  it("never references an idle video unless one is configured", () => {
    const cfg = resolveDisplayConfig(defaultDisplay());
    expect(cfg.idleVideo.mp4).toBeUndefined();
    expect(cfg.idleVideo.webm).toBeUndefined();
    expect(cfg.idleVideo.fallbackImage).toBe(FALLBACK_IMAGES["sky-wide"]);
  });

  it("the service survives corrupted storage and keeps saves across a refresh", async () => {
    const storage = memStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, display: { motion: "reduced", fallbackImage: 7 }, cameras: "broken" }));
    const a = createMockSettingsService({ storage, latencyMs: 0 });
    const d = await a.getDisplay();
    expect(d.motion).toBe("reduced");
    expect(d.fallbackImage).toBe("sky-wide");
    expect(Array.isArray(await a.listCameras())).toBe(true);
    await a.saveDisplay({ ...d, fallbackImage: "sky-dusk" });
    const b = createMockSettingsService({ storage, latencyMs: 0 });
    expect((await b.getDisplay()).fallbackImage).toBe("sky-dusk");
  });
});
