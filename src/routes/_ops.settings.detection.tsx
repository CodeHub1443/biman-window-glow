import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { PageError, PageSkeleton, Panel } from "@/components/ops/ui";
import { Notice, NumberField, RangeField, SaveBar, SelectField, ToggleField, WarningList } from "@/components/settings/form";
import { settingsHead } from "@/components/settings/sections";
import { useSectionForm } from "@/hooks/use-section-form";
import { settingsQueries, settingsService } from "@/lib/ops-queries";
import { validateDetection } from "@/lib/settings-logic";

export const Route = createFileRoute("/_ops/settings/detection")({
  loader: ({ context }) => context.queryClient.ensureQueryData(settingsQueries.detection()).then(() => undefined),
  head: () => settingsHead("Detection & Events", "Person detection threshold, face size and quality, event confirmation, cooldown and dwell-time policy (demo configuration)."),
  pendingComponent: PageSkeleton,
  errorComponent: ({ error }) => <PageError error={error} />,
  component: DetectionPage,
});

function DetectionPage() {
  const { data } = useSuspenseQuery(settingsQueries.detection());
  const { data: meta } = useQuery(settingsQueries.meta());
  const form = useSectionForm({ saved: data, validate: validateDetection, save: settingsService.saveDetection, label: "Detection & events" });
  const d = form.draft;

  return (
    <div className="space-y-5">
      <Notice tone="warning" title="Illustrative demo configuration">
        These defaults are placeholders. Confirm each parameter against the backend documentation before use; values that the backend does not support will be removed.
        The system detects faces only — it does not recognise or identify visitors.
      </Notice>

      <Panel title="Detection">
        <div className="grid gap-4 md:grid-cols-2">
          <RangeField form={form} path="personConfidence" label="Person detection confidence threshold" min={0.1} max={0.99} step={0.01} format={(v) => v.toFixed(2)} hint="Detections below this score are ignored." />
          <NumberField form={form} path="minFaceSizePx" label="Minimum face size" unit="px (shortest side)" min={20} max={600} />
          <ToggleField form={form} path="faceQuality.enabled" label="Filter low-quality face captures" hint="Blurry or partial captures are not shown on the display." />
          {d.faceQuality.enabled && <RangeField form={form} path="faceQuality.minScore" label="Minimum quality score" min={0} max={1} step={0.05} format={(v) => v.toFixed(2)} />}
        </div>
      </Panel>

      <Panel title="Events">
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField form={form} path="confirmation.policy" label="Event confirmation policy" options={[
            { value: "single_frame", label: "Single detection" },
            { value: "consecutive_frames", label: "Several consecutive frames" },
            { value: "line_crossing", label: "Virtual line crossing (if supported)" },
          ]} />
          {d.confirmation.policy === "consecutive_frames" && <NumberField form={form} path="confirmation.frames" label="Frames required" min={2} max={30} />}
          <NumberField form={form} path="duplicateCooldownSec" label="Duplicate-event cooldown" unit="s" min={0} max={600} hint="Same-camera events inside this window are treated as one." />
          <NumberField form={form} path="greetingDurationSec" label="Greeting display duration" unit="s" min={3} max={30} hint="Shared with General and Visitor Display." />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <ToggleField form={form} path="processing.saveFaceSnapshot" label="Save face snapshot with each event" />
          <ToggleField form={form} path="processing.keepNoFaceEvents" label="Keep events where no face was captured" />
          <NumberField form={form} path="processing.maxQueue" label="Display queue size" min={1} max={100} hint="Older waiting greetings are dropped beyond this." />
        </div>
      </Panel>

      <Panel title="Dwell-time matching">
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField form={form} path="dwell.policy" label="Dwell policy" options={[
            { value: "measured_only", label: "Measured only (continuous tracking session)" },
            { value: "measured_and_estimated", label: "Measured, plus estimated shown separately" },
          ]} />
          {d.dwell.policy === "measured_and_estimated" && (
            <NumberField form={form} path="dwell.maxEstimatedWindowMin" label="Estimated pairing window" unit="min" min={1} max={480} hint="Entries and exits further apart are left unpaired." />
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Measured dwell needs a continuous tracking session at the station. Estimated dwell pairs entries and exits by time order only and is never mixed with measured figures.
          Neither method identifies who the visitor is.
        </p>
      </Panel>

      <WarningList warnings={form.dirty ? form.warnings : []} />
      <SaveBar form={form} savedAt={meta?.lastSavedAt.detection} />
    </div>
  );
}
