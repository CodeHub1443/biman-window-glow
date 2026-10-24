import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Loader2, Volume2 } from "lucide-react";
import { useState } from "react";
import { DemoTag, field, ghostBtn, PageError, PageSkeleton, Panel, StatusPill } from "@/components/ops/ui";
import { Field, Notice, NumberField, RangeField, SaveBar, SelectField, ToggleField, WarningList, bind } from "@/components/settings/form";
import { settingsHead } from "@/components/settings/sections";
import { useSectionForm } from "@/hooks/use-section-form";
import { playDemoTone } from "@/lib/demo-audio";
import { healthQuery, settingsQueries, settingsService } from "@/lib/ops-queries";
import { validateAudio } from "@/lib/settings-logic";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_ops/settings/audio")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(settingsQueries.audio()),
      context.queryClient.ensureQueryData(settingsQueries.audioClips()),
      context.queryClient.ensureQueryData(settingsQueries.general()),
    ]).then(() => undefined),
  head: () => settingsHead("Greeting & Audio", "Welcome and goodbye sounds, volume, speaker per station and duplicate suppression, with in-browser previews."),
  pendingComponent: PageSkeleton,
  errorComponent: ({ error }) => <PageError error={error} />,
  component: AudioPage,
});

const SPEAKERS = [{ value: "SPK-1", label: "SPK-1 · Speaker set 1" }, { value: "SPK-2", label: "SPK-2 · Speaker set 2" }, { value: "", label: "No speaker" }];

interface Playback { at: number; clip: string; ok: boolean; message: string }

function AudioPage() {
  const { data } = useSuspenseQuery(settingsQueries.audio());
  const { data: clips } = useSuspenseQuery(settingsQueries.audioClips());
  const { data: general } = useSuspenseQuery(settingsQueries.general());
  const { data: meta } = useQuery(settingsQueries.meta());
  const { data: health } = useQuery(healthQuery());
  const form = useSectionForm({ saved: data, validate: (v) => validateAudio(v, clips), save: settingsService.saveAudio, label: "Greeting & audio" });
  const [playing, setPlaying] = useState<string | null>(null);
  const [history, setHistory] = useState<Playback[]>([]);
  const speakerStatus = (id: string) => health?.stations.flatMap((s) => s.devices).find((d) => d.id === id);

  const preview = async (clipId: string) => {
    const clip = clips.find((c) => c.id === clipId);
    if (!clip) return;
    setPlaying(clipId);
    try {
      await playDemoTone(clip.tone, form.draft.volume);
      setHistory((h) => [{ at: Date.now(), clip: clip.label, ok: true, message: clip.tone.length ? "Played in this browser only (simulated)." : "No audio selected." }, ...h].slice(0, 6));
    } catch (e) {
      setHistory((h) => [{ at: Date.now(), clip: clip.label, ok: false, message: e instanceof Error ? e.message : "Playback failed." }, ...h].slice(0, 6));
    } finally {
      setPlaying(null);
    }
  };

  const clipSelect = (path: "welcomeClipId" | "goodbyeClipId", kind: "welcome" | "goodbye", label: string) => {
    const b = bind(form, path);
    return (
      <Field label={label} {...b}>
        {(id, d) => (
          <div className="flex gap-2">
            <select id={id} value={form.draft[path]} aria-describedby={d} onChange={(e) => form.set(path, e.target.value)} className={cn(field, "w-full")}>
              {clips.filter((c) => c.kind === kind || c.id === "none").map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <button type="button" onClick={() => void preview(form.draft[path])} disabled={!!playing} className={ghostBtn} aria-label={`Preview ${label}`}>
              {playing === form.draft[path] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}Preview
            </button>
          </div>
        )}
      </Field>
    );
  };

  return (
    <div className="space-y-5">
      <Notice title="Simulated playback">Previews play a short demo tone through this browser only. Station speakers are not connected and will not play anything.</Notice>

      <Panel title="Greeting sounds">
        <div className="grid gap-4 md:grid-cols-2">
          {clipSelect("welcomeClipId", "welcome", "Welcome (entry) sound")}
          {clipSelect("goodbyeClipId", "goodbye", "Goodbye (exit) sound")}
        </div>
        <div className="mt-4 max-w-md"><RangeField form={form} path="volume" label="Volume" min={0} max={100} step={5} format={(v) => `${v}%`} /></div>
      </Panel>

      <Panel title="Speaker assignment">
        <div className="grid gap-4 md:grid-cols-2">
          {form.draft.speakers.map((s, i) => {
            const st = speakerStatus(s.speakerId);
            return (
              <div key={s.stationId} className="space-y-2 rounded-md border border-border p-3">
                <SelectField form={form} path={`speakers.${i}.speakerId`} label={general.stations.find((x) => x.id === s.stationId)?.label ?? s.stationId} options={SPEAKERS} />
                <div className="flex items-center gap-2 text-xs text-muted-foreground">Last-known (demo): {st ? <StatusPill status={st.status} /> : "—"}</div>
                {st?.status === "offline" && <p className="text-xs text-destructive">{st.label} is offline in demo health data — greeting audio would be skipped at this station.</p>}
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Duplicate suppression">
        <div className="grid gap-4 md:grid-cols-2">
          <ToggleField form={form} path="suppressDuplicateAudio" label="Don't replay audio for a duplicate event ID" hint="Matches the display's duplicate-ID suppression." />
          <ToggleField form={form} path="playOnNoFace" label="Play audio when no face was captured" />
          <NumberField form={form} path="minGapSec" label="Minimum gap between greeting sounds" unit="s" min={0} max={600} />
        </div>
      </Panel>

      <Panel title="Playback status" meta={<DemoTag>this browser only</DemoTag>}>
        {history.length === 0 ? <p className="text-sm text-muted-foreground">No previews played yet.</p> : (
          <ul className="space-y-1 font-mono text-xs">
            {history.map((h, i) => (
              <li key={`${h.at}-${i}`} className="flex gap-3">
                <span className="text-muted-foreground">{new Date(h.at).toLocaleTimeString([], { hour12: false })}</span>
                <span>{h.clip}</span>
                <span className={h.ok ? "text-primary" : "text-destructive"}>{h.message}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <WarningList warnings={form.dirty ? form.warnings : []} />
      <SaveBar form={form} savedAt={meta?.lastSavedAt.audio} />
    </div>
  );
}
