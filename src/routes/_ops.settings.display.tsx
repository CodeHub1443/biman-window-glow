import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { ExternalLink, Maximize, PlaneLanding, PlaneTakeoff, Sun } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ghostBtn, PageError, PageSkeleton, Panel } from "@/components/ops/ui";
import { Notice, NumberField, SaveBar, SelectField, TextField, WarningList } from "@/components/settings/form";
import { settingsHead } from "@/components/settings/sections";
import { useSectionForm } from "@/hooks/use-section-form";
import { FALLBACK_IMAGES, FALLBACK_LABELS, type PreviewMessage } from "@/lib/display-images";
import { settingsQueries, settingsService } from "@/lib/ops-queries";
import { validateDisplay } from "@/lib/settings-logic";
import { cn } from "@/lib/utils";
import type { FallbackImageKey, VisitorDisplaySettings } from "@/types/settings";

export const Route = createFileRoute("/_ops/settings/display")({
  loader: ({ context }) => context.queryClient.ensureQueryData(settingsQueries.display()).then(() => undefined),
  head: () => settingsHead("Visitor Display", "Idle video source, fallback image, fit, greeting headlines, motion and a live preview of the airplane-window display."),
  pendingComponent: PageSkeleton,
  errorComponent: ({ error }) => <PageError error={error} />,
  component: DisplayPage,
});

function DisplayPage() {
  const { data } = useSuspenseQuery(settingsQueries.display());
  const { data: meta } = useQuery(settingsQueries.meta());
  const form = useSectionForm({ saved: data, validate: validateDisplay, save: settingsService.saveDisplay, label: "Visitor display" });
  const d = form.draft;
  const valid = Object.keys(form.errors).length === 0;

  return (
    <div className="space-y-5">
      <Notice tone="info" title="Saved settings apply to the live screens">
        After you save, the Visitor Display and kiosk use these settings (open screens update automatically). Unsaved edits appear only in the preview below. If saved settings are missing or damaged, the screens fall back to the built-in defaults.
      </Notice>

      <PreviewFrame settings={valid ? d : form.saved} stale={!valid} />

      <Panel title="Idle video">
        <div className="grid gap-4 md:grid-cols-2">
          <TextField form={form} path="idleVideoMp4" label="MP4 source" placeholder="/videos/idle.mp4" hint="Leave empty until the real video is supplied. The fallback image is shown meanwhile." />
          <TextField form={form} path="idleVideoWebm" label="WebM source (optional)" placeholder="/videos/idle.webm" />
          <SelectField form={form} path="fit" label="Video fit" options={[{ value: "cover", label: "Fill the window (crop edges)" }, { value: "contain", label: "Fit whole video (may letterbox)" }]} />
        </div>
      </Panel>

      <Panel title="Fallback image">
        <div role="radiogroup" aria-label="Fallback image" className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(FALLBACK_IMAGES) as FallbackImageKey[]).map((k) => (
            <button key={k} role="radio" aria-checked={d.fallbackImage === k} onClick={() => form.set("fallbackImage", k)}
              className={cn("overflow-hidden rounded-md border text-left transition", d.fallbackImage === k ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/40")}>
              <img src={FALLBACK_IMAGES[k]} alt="" loading="lazy" width={480} height={270} className="aspect-video w-full object-cover" />
              <div className="px-3 py-2 text-sm">{FALLBACK_LABELS[k]}</div>
            </button>
          ))}
        </div>
        {form.isFieldDirty("fallbackImage") && <button onClick={() => form.resetField("fallbackImage")} className="mt-2 font-mono text-[10px] uppercase tracking-wider text-gold hover:underline">changed · reset</button>}
      </Panel>

      <Panel title="Greeting">
        <div className="grid gap-4 md:grid-cols-2">
          <NumberField form={form} path="greetingDurationMs" label="Greeting display duration" unit="s" min={3000} max={30000} scale={1000} step={0.5} hint="Shared with General and Detection settings." />
          <SelectField form={form} path="motion" label="Animation" options={[{ value: "full", label: "Full motion (sky drift, slide-in greetings)" }, { value: "reduced", label: "Reduced motion (no drift or slide-ins)" }]} />
          <TextField form={form} path="entry.headline" label="Entry headline" />
          <TextField form={form} path="entry.sub" label="Entry message" />
          <TextField form={form} path="exit.headline" label="Exit headline" />
          <TextField form={form} path="exit.sub" label="Exit message" />
        </div>
      </Panel>

      <WarningList warnings={form.warnings} />
      <SaveBar form={form} savedAt={meta?.lastSavedAt.display} />
    </div>
  );
}

function PreviewFrame({ settings, stale }: { settings: VisitorDisplaySettings; stale: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(0.4);
  const [ready, setReady] = useState(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const post = useCallback((m: PreviewMessage) => frame.current?.contentWindow?.postMessage(m, window.location.origin), []);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setScale(e.contentRect.width / 1920));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const onMsg = (e: MessageEvent<PreviewMessage>) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow || e.data?.source !== "biman-display-preview") return;
      setReady(true);
      post({ source: "biman-settings", type: "config", settings: settingsRef.current });
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [post]);
  useEffect(() => {
    if (ready) post({ source: "biman-settings", type: "config", settings });
  }, [settings, ready, post]);

  const show = (state: "idle" | "entry" | "exit") => post({ source: "biman-settings", type: "show", state });

  return (
    <Panel title="Preview" meta={stale ? <span className="text-xs text-destructive">Showing saved values until errors are fixed</span> : <span className="font-mono text-[10px] uppercase text-muted-foreground">includes unsaved edits</span>}>
      <div className="mb-3 flex flex-wrap gap-2">
        <button onClick={() => show("idle")} disabled={!ready} className={ghostBtn}><Sun className="h-4 w-4" />Idle</button>
        <button onClick={() => show("entry")} disabled={!ready} className={ghostBtn}><PlaneLanding className="h-4 w-4" />Entry greeting</button>
        <button onClick={() => show("exit")} disabled={!ready} className={ghostBtn}><PlaneTakeoff className="h-4 w-4" />Exit greeting</button>
        <button onClick={() => void wrap.current?.requestFullscreen?.().catch(() => {})} className={cn(ghostBtn, "ml-auto")}><Maximize className="h-4 w-4" />Full screen</button>
        <a href="/display-preview" target="_blank" rel="noopener" className={ghostBtn}><ExternalLink className="h-4 w-4" />New tab (saved)</a>
      </div>
      <div ref={wrap} className="relative aspect-video w-full overflow-hidden rounded-md border border-border bg-background">
        <iframe
          ref={frame}
          src="/display-preview"
          title="Visitor Display preview"
          className="absolute left-0 top-0 origin-top-left border-0"
          style={{ width: 1920, height: 1080, transform: `scale(${scale})` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Preview greetings use demo faces and run only inside this frame; they are not sent to the Visitor Display or kiosk.</p>
    </Panel>
  );
}
