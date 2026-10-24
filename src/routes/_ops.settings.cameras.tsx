import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Eye, EyeOff, FlaskConical, Loader2, Pencil, Plus, ScanSearch, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { DemoTag, EmptyState, ghostBtn, PageError, PageSkeleton, Panel, StatusPill } from "@/components/ops/ui";
import { ConfirmDialog, Field, inputCls, Notice, NumberField, SaveStatusChip, SelectField, TextField, ToggleField, UnsavedChangesGuard, WarningList, bind } from "@/components/settings/form";
import { settingsHead } from "@/components/settings/sections";
import { useSectionForm } from "@/hooks/use-section-form";
import { healthQuery, settingsQueries, settingsService } from "@/lib/ops-queries";
import { blankCamera, extractCredentials, maskSecret, PLANNED_CAMERA_COUNT, validateCamera } from "@/lib/settings-logic";
import type { CameraView } from "@/services/settings-service";
import type { CameraConfig, ConnectionTestResult, RtspTransport } from "@/types/settings";

export const Route = createFileRoute("/_ops/settings/cameras")({
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(settingsQueries.cameras()), context.queryClient.ensureQueryData(settingsQueries.general())]).then(() => undefined),
  head: () => settingsHead("Camera Configuration", "Add, edit, enable and test the entry and exit cameras, including RTSP transport and reconnect settings."),
  pendingComponent: PageSkeleton,
  errorComponent: ({ error }) => <PageError error={error} />,
  component: CamerasPage,
});

const TRANSPORTS: { value: RtspTransport; label: string }[] = [
  { value: "tcp", label: "RTSP over TCP (interleaved)" },
  { value: "udp", label: "RTSP over UDP" },
  { value: "http", label: "RTSP over HTTP tunnel" },
  { value: "auto", label: "Automatic" },
];

function TestResult({ r }: { r: ConnectionTestResult }) {
  return (
    <div className={`rounded-md border px-3 py-2 text-sm ${r.ok ? "border-primary/40" : "border-destructive/50 bg-destructive/5"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <DemoTag>Simulated result</DemoTag>
        <span className={`font-mono text-[11px] uppercase tracking-wider ${r.ok ? "text-primary" : "text-destructive"}`}>{r.ok ? "Check passed" : `Failed at ${r.stage}`}</span>
        {r.latencyMs != null && <span className="font-mono text-[11px] text-muted-foreground">{r.latencyMs} ms (simulated)</span>}
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">{new Date(r.at).toLocaleTimeString([], { hour12: false })}</span>
      </div>
      <p className="mt-1 text-muted-foreground">{r.message}</p>
    </div>
  );
}

function CamerasPage() {
  const { data: cameras } = useSuspenseQuery(settingsQueries.cameras());
  const { data: general } = useSuspenseQuery(settingsQueries.general());
  const { data: health } = useQuery(healthQuery());
  const qc = useQueryClient();
  const [editing, setEditing] = useState<{ mode: "create" | "update"; camera: CameraView } | null>(null);
  const [deleting, setDeleting] = useState<CameraView | null>(null);
  const [results, setResults] = useState<Record<string, ConnectionTestResult>>({});
  const [testing, setTesting] = useState<string | null>(null);

  const stationLabel = (id: string) => general.stations.find((s) => s.id === id)?.label ?? `${id} (unknown station)`;
  const lastKnown = (id: string) => health?.stations.flatMap((s) => s.devices).find((d) => d.id === id);

  const toggle = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => settingsService.setCameraEnabled(id, enabled),
    onSuccess: (c) => { void qc.invalidateQueries({ queryKey: ["settings"] }); toast.success(`${c.id} ${c.enabled ? "enabled" : "disabled"}`, { description: "Demo configuration only." }); },
    onError: (e) => toast.error("Change not saved", { description: e.message }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => settingsService.deleteCamera(id),
    onSuccess: (_v, id) => { void qc.invalidateQueries({ queryKey: ["settings"] }); toast.success(`${id} deleted`); },
    onError: (e) => toast.error("Camera not deleted", { description: e.message }),
  });
  const runTest = async (c: CameraView) => {
    setTesting(c.id);
    const r = await settingsService.testConnection({ ...c, password: null });
    setResults((m) => ({ ...m, [c.id]: r }));
    setTesting(null);
  };

  const onAdd = () => {
    const blank = blankCamera(cameras.map((c) => ({ ...c, password: "" })), general.stations[0]?.id);
    const { password: _p, ...rest } = blank;
    setEditing({ mode: "create", camera: { ...rest, passwordSet: false } });
  };

  return (
    <div className="space-y-5">
      <Notice title="Demo cameras · no hardware connected">
        Camera addresses use a documentation-only network range (192.0.2.x) and cannot reach real devices. Connection tests only check the settings and
        are labelled as simulated; nothing here confirms a camera is connected. Passwords are kept in memory for this tab only and never written to browser storage.
      </Notice>

      <Panel
        title={`Cameras · ${cameras.length} of ${PLANNED_CAMERA_COUNT} planned`}
        meta={<button onClick={onAdd} className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><Plus className="h-4 w-4" />Add camera</button>}
      >
        {cameras.length === 0 ? (
          <EmptyState title="No cameras configured" hint="Add the entry and exit cameras for each station." />
        ) : (
          <ul className="divide-y divide-border">
            {cameras.map((c) => {
              const hk = lastKnown(c.id);
              const r = results[c.id];
              return (
                <li key={c.id} className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{c.id}</span>
                      <span className="font-medium">{c.name}</span>
                      <span className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase ring-1 ${c.role === "entry" ? "bg-entry/20 ring-entry/60" : "bg-exit/20 ring-exit/60"}`}>{c.role}</span>
                      {!c.enabled && <span className="rounded-sm border border-border px-1.5 font-mono text-[10px] uppercase text-muted-foreground">disabled</span>}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">{c.location} · {stationLabel(c.stationId)}</div>
                    <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
                      {c.rtspUrl || "No RTSP URL"} · {c.transport.toUpperCase()} · {c.username ? `user ${c.username}` : "no user"} · {c.passwordSet ? `password ${maskSecret("x")}` : "no password"}
                    </div>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2"><span className="text-muted-foreground">Last-known (demo):</span>{hk ? <StatusPill status={hk.status} /> : <span className="font-mono text-[11px] uppercase text-muted-foreground">unknown</span>}</div>
                    {hk?.detail && <div className="font-mono text-[11px] text-muted-foreground">{hk.detail}</div>}
                    {r && <div className={`font-mono text-[11px] ${r.ok ? "text-primary" : "text-destructive"}`}>Simulated test: {r.ok ? "passed" : `failed (${r.stage})`}</div>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Switch checked={c.enabled} disabled={toggle.isPending} onCheckedChange={(v) => toggle.mutate({ id: c.id, enabled: v })} aria-label={`${c.enabled ? "Disable" : "Enable"} ${c.id}`} />
                      {c.enabled ? "On" : "Off"}
                    </label>
                    <button onClick={() => void runTest(c)} disabled={testing === c.id} className={ghostBtn} aria-label={`Test connection for ${c.id}`}>
                      {testing === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}Test
                    </button>
                    <Link to="/settings/roi" search={{ camera: c.id }} className={ghostBtn} aria-label={`Edit ROI for ${c.id}`}><ScanSearch className="h-4 w-4" />ROI</Link>
                    <button onClick={() => setEditing({ mode: "update", camera: c })} className={ghostBtn} aria-label={`Edit ${c.id}`}><Pencil className="h-4 w-4" />Edit</button>
                    <button onClick={() => setDeleting(c)} className={`${ghostBtn} text-destructive`} aria-label={`Delete ${c.id}`}><Trash2 className="h-4 w-4" /></button>
                  </div>
                  {r && <div className="lg:col-span-3"><TestResult r={r} /></div>}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <CameraEditor
            key={`${editing.mode}-${editing.camera.id}`}
            mode={editing.mode}
            camera={editing.camera}
            all={cameras}
            stations={general.stations}
            onDone={() => setEditing(null)}
            onTested={(r) => setResults((m) => ({ ...m, [r.cameraId]: r }))}
          />
        )}
      </Sheet>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.id}?`}
        description={<>This removes <b>{deleting?.name}</b>, its ROI zones and its station assignment from the demo configuration. This cannot be undone.</>}
        confirmLabel="Delete camera"
        destructive
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      />
    </div>
  );
}

type Draft = CameraConfig & { clearPassword: boolean };

function CameraEditor({ mode, camera, all, stations, onDone, onTested }: {
  mode: "create" | "update"; camera: CameraView; all: CameraView[]; stations: { id: string; label: string }[];
  onDone: () => void; onTested: (r: ConnectionTestResult) => void;
}) {
  const saved = useMemo<Draft>(() => {
    const { passwordSet: _ps, ...rest } = camera;
    return { ...rest, password: "", clearPassword: false };
  }, [camera]);
  const others = useMemo(() => all.map((c) => ({ ...c, password: "" })), [all]);
  const stationIds = stations.map((s) => s.id);
  const validate = useCallback(
    (d: Draft) => validateCamera({ ...d, passwordSet: camera.passwordSet && !d.clearPassword }, others, stationIds),
    [camera.passwordSet, others, stationIds.join()], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const toSave = (d: Draft) => {
    const { clearPassword, password, ...rest } = d;
    return { ...rest, password: clearPassword ? "" : password ? password : mode === "create" ? "" : null };
  };
  const form = useSectionForm<Draft>({
    saved,
    validate,
    label: mode === "create" ? "Camera" : `${camera.id}`,
    save: async (d) => {
      await settingsService.saveCamera(toSave(d), mode);
      onDone();
      return d;
    },
  });
  const [showPw, setShowPw] = useState(false);
  const [confirm, setConfirm] = useState<null | "warnings" | "discard">(null);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<ConnectionTestResult | null>(null);
  const pw = bind(form, "password");
  const url = bind(form, "rtspUrl");

  const onUrlBlur = () => {
    const x = extractCredentials(form.draft.rtspUrl);
    if (!x.extracted) return;
    form.update((d) => ({ ...d, rtspUrl: x.url, username: x.username || d.username, password: x.password || d.password }));
    toast.warning("Credentials moved out of the URL", { description: "The username and password were moved into their own fields so they are not shown in the address." });
  };
  const test = async () => {
    setTesting(true);
    const r = await settingsService.testConnection({ ...toSave(form.draft) });
    setResult(r);
    onTested(r);
    setTesting(false);
  };
  const save = async (confirmed = false) => {
    const r = await form.submit({ confirmed });
    if (r === "needs-confirm") setConfirm("warnings");
  };

  return (
    <SheetContent
      side="right"
      className="w-full overflow-y-auto sm:max-w-xl"
      onInteractOutside={(e) => { if (form.dirty) { e.preventDefault(); setConfirm("discard"); } }}
      onEscapeKeyDown={(e) => { if (form.dirty) { e.preventDefault(); setConfirm("discard"); } }}
    >
      <SheetTitle>{mode === "create" ? "Add camera" : `Edit ${camera.id}`}</SheetTitle>
      <SheetDescription>Demo configuration. Saving does not change any real camera.</SheetDescription>

      <div className="mt-5 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField form={form} path="name" label="Camera name" placeholder="e.g. Lobby entry" />
          <TextField form={form} path="location" label="Location" placeholder="e.g. Main lobby · doors" demo={mode === "update"} />
          <SelectField form={form} path="role" label="Role" options={[{ value: "entry", label: "Entry" }, { value: "exit", label: "Exit" }]} />
          <SelectField form={form} path="stationId" label="Station" options={stations.map((s) => ({ value: s.id, label: s.label }))} />
        </div>
        <ToggleField form={form} path="enabled" label="Camera enabled" hint="Disabled cameras are skipped for detection and preview." />

        <fieldset className="space-y-4 rounded-md border border-border p-4">
          <legend className="px-1 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">RTSP stream</legend>
          <Field label="RTSP URL" hint="Address only — enter credentials in the fields below." {...url}>
            {(id, d) => (
              <input id={id} value={form.draft.rtspUrl} onChange={(e) => form.set("rtspUrl", e.target.value)} onBlur={onUrlBlur} placeholder="rtsp://192.0.2.10:554/stream1"
                spellCheck={false} autoComplete="off" aria-invalid={!!url.error} aria-describedby={d} className={`${inputCls(url.error)} font-mono`} />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField form={form} path="username" label="Username" autoComplete="off" />
            <Field label="Password" hint={camera.passwordSet && !form.draft.clearPassword ? "A password is set. Leave blank to keep it." : "Use a fake value in this prototype."} {...pw}>
              {(id, d) => (
                <div className="flex gap-2">
                  <input id={id} type={showPw ? "text" : "password"} value={form.draft.password} autoComplete="new-password" spellCheck={false}
                    placeholder={camera.passwordSet && !form.draft.clearPassword ? maskSecret("x") : ""}
                    onChange={(e) => form.update((x) => ({ ...x, password: e.target.value, clearPassword: false }))}
                    aria-invalid={!!pw.error} aria-describedby={d} className={inputCls(pw.error)} />
                  <button type="button" onClick={() => setShowPw((s) => !s)} className={ghostBtn} aria-label={showPw ? "Hide password" : "Show password"} aria-pressed={showPw}>
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              )}
            </Field>
          </div>
          {camera.passwordSet && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={form.draft.clearPassword} onChange={(e) => form.update((x) => ({ ...x, clearPassword: e.target.checked, password: "" }))} className="accent-primary" />
              Remove the saved password
            </label>
          )}
          <SelectField form={form} path="transport" label="Transport" options={TRANSPORTS} />
        </fieldset>

        <fieldset className="grid gap-4 rounded-md border border-border p-4 sm:grid-cols-2">
          <legend className="px-1 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Connection</legend>
          <NumberField form={form} path="timeoutSec" label="Connection timeout" unit="s" min={1} max={60} />
          <div className="sm:col-span-2"><ToggleField form={form} path="reconnect.enabled" label="Reconnect automatically" /></div>
          <NumberField form={form} path="reconnect.intervalSec" label="Reconnect interval" unit="s" min={1} max={300} />
          <NumberField form={form} path="reconnect.maxAttempts" label="Max attempts" unit="0 = unlimited" min={0} max={100} />
        </fieldset>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void test()} disabled={testing} className={ghostBtn}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}Test connection (simulated)
            </button>
            <span className="text-xs text-muted-foreground">Tests the values above, including unsaved edits.</span>
          </div>
          {result && <TestResult r={result} />}
        </div>

        <div className="rounded-md border border-border p-3 font-mono text-[11px] text-muted-foreground">
          <div className="mb-1 uppercase tracking-[0.2em]">Diagnostics</div>
          <div>id {form.draft.id} · transport {form.draft.transport} · timeout {form.draft.timeoutSec}s · reconnect {form.draft.reconnect.enabled ? `every ${form.draft.reconnect.intervalSec}s` : "off"}</div>
          <div>credentials: {form.draft.username ? "user set" : "no user"}, {form.draft.password || (camera.passwordSet && !form.draft.clearPassword) ? `password ${maskSecret("x")}` : "no password"}</div>
          <div>stream status: not verified — no backend connected</div>
        </div>

        <WarningList warnings={form.warnings} />
      </div>

      <div className="sticky bottom-0 -mx-6 mt-6 flex items-center gap-2 border-t border-border bg-background px-6 py-3">
        <SaveStatusChip status={form.status} />
        <div className="ml-auto flex gap-2">
          <button type="button" className={ghostBtn} onClick={() => (form.dirty ? setConfirm("discard") : onDone())}>Cancel</button>
          <button type="button" onClick={() => void save()} disabled={form.status === "saving" || (mode === "update" && !form.dirty)}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40">
            {form.status === "saving" && <Loader2 className="h-4 w-4 animate-spin" />}{mode === "create" ? "Add camera" : "Save camera"}
          </button>
        </div>
      </div>

      <ConfirmDialog open={confirm === "warnings"} onOpenChange={(o) => !o && setConfirm(null)} title="Save incomplete configuration?"
        description={<ul className="list-disc space-y-1 pl-5">{form.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
        confirmLabel="Save anyway" onConfirm={() => void save(true)} />
      <ConfirmDialog open={confirm === "discard"} onOpenChange={(o) => !o && setConfirm(null)} title="Discard changes?"
        description="Your edits to this camera have not been saved." confirmLabel="Discard" destructive onConfirm={onDone} />
      <UnsavedChangesGuard when={form.dirty} />
    </SheetContent>
  );
}
