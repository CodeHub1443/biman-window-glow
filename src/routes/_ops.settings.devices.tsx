import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { Loader2, Stethoscope } from "lucide-react";
import { DemoTag, ghostBtn, PageError, PageSkeleton, Panel, StatusPill } from "@/components/ops/ui";
import { Notice, NumberField, SaveBar, SelectField, TextField, WarningList } from "@/components/settings/form";
import { settingsHead } from "@/components/settings/sections";
import { useSectionForm } from "@/hooks/use-section-form";
import { healthQuery, settingsQueries, settingsService } from "@/lib/ops-queries";
import { validateDevices } from "@/lib/settings-logic";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_ops/settings/devices")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(settingsQueries.devices()),
      context.queryClient.ensureQueryData(settingsQueries.cameras()),
      context.queryClient.ensureQueryData(settingsQueries.general()),
    ]).then(() => undefined),
  head: () => settingsHead("Device & Network", "Station device assignments, edge device labels, backend address placeholders, timeouts and simulated network diagnostics."),
  pendingComponent: PageSkeleton,
  errorComponent: ({ error }) => <PageError error={error} />,
  component: DevicesPage,
});

const RESULT_CLS = { pass: "text-primary", warn: "text-gold", fail: "text-destructive", skipped: "text-muted-foreground" };

function DevicesPage() {
  const { data } = useSuspenseQuery(settingsQueries.devices());
  const { data: cameras } = useSuspenseQuery(settingsQueries.cameras());
  const { data: general } = useSuspenseQuery(settingsQueries.general());
  const { data: meta } = useQuery(settingsQueries.meta());
  const { data: health } = useQuery(healthQuery());
  const form = useSectionForm({ saved: data, validate: validateDevices, save: settingsService.saveDevices, label: "Device & network" });
  const diag = useMutation({ mutationFn: () => settingsService.runDiagnostics(form.draft) });
  const d = form.draft;

  const none = { value: "", label: "— Not assigned —" };
  const camOpts = (role: "entry" | "exit") => [none, ...cameras.filter((c) => c.role === role).map((c) => ({ value: c.id, label: `${c.id} · ${c.name}` }))];
  const edgeOpts = [none, ...d.edgeDevices.map((e) => ({ value: e.id, label: `${e.id} · ${e.label}` }))];
  const displayOpts = [none, { value: "DISP-1", label: "DISP-1 · Visitor display 1" }, { value: "DISP-2", label: "DISP-2 · Visitor display 2" }];
  const speakerOpts = [none, { value: "SPK-1", label: "SPK-1 · Speaker set 1" }, { value: "SPK-2", label: "SPK-2 · Speaker set 2" }];
  const devices = health?.stations.flatMap((s) => s.devices) ?? [];

  return (
    <div className="space-y-5">
      <Notice title="Backend not connected">These settings are stored in this browser only. Saving them does not change any device, network or server.</Notice>

      <Panel title="Station-to-device assignments">
        <div className="grid gap-4 lg:grid-cols-2">
          {d.assignments.map((a, i) => (
            <fieldset key={a.stationId} className="space-y-3 rounded-md border border-border p-4">
              <legend className="px-1 text-sm font-medium">{general.stations.find((s) => s.id === a.stationId)?.label ?? a.stationId}</legend>
              <SelectField form={form} path={`assignments.${i}.edgeDeviceId`} label="Edge device" options={edgeOpts} />
              <div className="grid gap-3 sm:grid-cols-2">
                <SelectField form={form} path={`assignments.${i}.entryCameraId`} label="Entry camera" options={camOpts("entry")} />
                <SelectField form={form} path={`assignments.${i}.exitCameraId`} label="Exit camera" options={camOpts("exit")} />
                <SelectField form={form} path={`assignments.${i}.displayId`} label="Visitor display" options={displayOpts} />
                <SelectField form={form} path={`assignments.${i}.speakerId`} label="Speaker set" options={speakerOpts} />
              </div>
            </fieldset>
          ))}
        </div>
      </Panel>

      <Panel title="Edge devices">
        <div className="grid gap-4 md:grid-cols-2">
          {d.edgeDevices.map((e, i) => <TextField key={e.id} form={form} path={`edgeDevices.${i}.label`} label={`${e.id} label`} demo />)}
        </div>
      </Panel>

      <Panel title="Backend connectivity" meta={<DemoTag>placeholders</DemoTag>}>
        <div className="grid gap-4 md:grid-cols-2">
          <TextField form={form} path="backend.apiBaseUrl" label="Backend API address" placeholder="https://visitor-backend.example/api" hint="Left empty until the backend is provided." />
          <TextField form={form} path="backend.eventStreamUrl" label="Event stream address" placeholder="wss://visitor-backend.example/events" />
          <NumberField form={form} path="requestTimeoutSec" label="Request timeout" unit="s" min={1} max={120} />
          <div className="grid grid-cols-2 gap-4">
            <NumberField form={form} path="retry.attempts" label="Retry attempts" min={0} max={10} />
            <NumberField form={form} path="retry.backoffSec" label="Retry backoff" unit="s" min={0} max={60} />
          </div>
        </div>
      </Panel>

      <Panel title="Network diagnostics" meta={<button onClick={() => diag.mutate()} disabled={diag.isPending} className={ghostBtn}>{diag.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />}Run simulated diagnostics</button>}>
        {!diag.data ? <p className="text-sm text-muted-foreground">Checks the configuration above against demo health data. No network traffic is sent.</p> : (
          <ul className="divide-y divide-border">
            {diag.data.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className={cn("w-16 font-mono text-[11px] uppercase", RESULT_CLS[c.result])}>{c.result}</span>
                <span className="font-medium">{c.label}</span>
                <span className="text-muted-foreground">{c.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Device status · last-known (demo)">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {devices.map((dev) => (
            <div key={dev.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
              <div><div className="font-mono text-xs">{dev.id}</div><div className="text-xs text-muted-foreground">{dev.label}</div></div>
              <StatusPill status={dev.status} />
            </div>
          ))}
        </div>
      </Panel>

      <WarningList warnings={form.dirty ? form.warnings : []} />
      <SaveBar form={form} savedAt={meta?.lastSavedAt.devices} />
    </div>
  );
}
