import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { MousePointer2, PenLine, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import stillLobby from "@/assets/roi-still-lobby.jpg";
import { EmptyState, field, ghostBtn, PageError, PageSkeleton, Panel } from "@/components/ops/ui";
import { RoiEditor, type EditorMode } from "@/components/settings/RoiEditor";
import { ConfirmDialog, Notice, SaveBar, WarningList } from "@/components/settings/form";
import { settingsHead } from "@/components/settings/sections";
import { useSectionForm } from "@/hooks/use-section-form";
import { settingsQueries, settingsService } from "@/lib/ops-queries";
import { clampPoint, defaultRoi, deletePoint, movePoint, validateRoi } from "@/lib/settings-logic";
import { cn } from "@/lib/utils";
import type { RoiConfig, RoiZone } from "@/types/settings";

const searchSchema = z.object({ camera: fallback(z.string(), "").default("") });

export const Route = createFileRoute("/_ops/settings/roi")({
  validateSearch: zodValidator(searchSchema),
  loader: ({ context }) => context.queryClient.ensureQueryData(settingsQueries.cameras()).then(() => undefined),
  head: () => settingsHead("ROI Editor", "Draw and edit entry and exit regions and a virtual crossing line for each camera on a still placeholder image."),
  pendingComponent: PageSkeleton,
  errorComponent: ({ error }) => <PageError error={error} />,
  component: RoiPage,
});

function RoiPage() {
  const { camera: requested } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: cameras } = useSuspenseQuery(settingsQueries.cameras());
  const match = cameras.find((c) => c.id === requested);
  const camera = match ?? cameras[0];

  if (!camera) return <Panel><EmptyState title="No cameras configured" hint="Add a camera in Camera Configuration before drawing regions." /></Panel>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1.5">
          <span className="block text-sm font-medium">Camera</span>
          <select value={camera.id} onChange={(e) => navigate({ search: { camera: e.target.value } })} className={cn(field, "min-w-64")}>
            {cameras.map((c) => <option key={c.id} value={c.id}>{c.id} · {c.name}{c.enabled ? "" : " (disabled)"}</option>)}
          </select>
        </label>
        <p className="pb-2 text-xs text-muted-foreground">No live stream is needed: regions are drawn on a still placeholder.</p>
      </div>
      {requested && !match && <Notice tone="warning">Camera "{requested.slice(0, 40)}" was not found. Showing {camera.id} instead.</Notice>}
      <CameraRoi key={camera.id} cameraId={camera.id} role={camera.role} />
    </div>
  );
}

function CameraRoi({ cameraId, role }: { cameraId: string; role: "entry" | "exit" }) {
  const { data, isPending, error } = useQuery(settingsQueries.roi(cameraId));
  if (error) return <PageError error={error} />;
  if (isPending || !data) return <PageSkeleton />;
  return <RoiForm saved={data} role={role} />;
}

function RoiForm({ saved, role }: { saved: RoiConfig; role: "entry" | "exit" }) {
  const { data: meta } = useQuery(settingsQueries.meta());
  const validate = useMemo(() => (v: RoiConfig) => validateRoi(v, role), [role]);
  const form = useSectionForm({ saved, validate, save: settingsService.saveRoi, label: `ROI for ${saved.cameraId}` });
  const [mode, setMode] = useState<EditorMode>("select");
  const [selected, setSelected] = useState<string | null>(saved.zones[0]?.id ?? null);
  const [confirm, setConfirm] = useState<null | "reset" | { zone: RoiZone }>(null);
  const d = form.draft;
  const zone = d.zones.find((z) => z.id === selected) ?? null;
  const invalid = new Set(d.zones.filter((z) => form.errors[`zones.${z.id}`]).map((z) => z.id));
  const zoneErrors = Object.entries(form.errors).filter(([k]) => k.startsWith("zones.") || k === "line").map(([, v]) => v);

  const setZone = (z: RoiZone) => form.update((x) => ({ ...x, zones: x.zones.map((q) => (q.id === z.id ? z : q)) }));
  const addZone = (kind: "entry" | "exit") => {
    let n = d.zones.length + 1;
    while (d.zones.some((z) => z.id === `${d.cameraId}-Z${n}`)) n += 1;
    const id = `${d.cameraId}-Z${n}`;
    const count = d.zones.filter((z) => z.kind === kind).length + 1;
    form.update((x) => ({ ...x, zones: [...x.zones, { id, kind, label: `${kind === "entry" ? "Entry" : "Exit"} zone ${count}`, points: [] }] }));
    setSelected(id);
    setMode("draw");
  };

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="ROI tools">
            <div className="inline-flex rounded-md border border-border p-0.5">
              <button onClick={() => setMode("select")} aria-pressed={mode === "select"} className={cn("inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-sm", mode === "select" ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>
                <MousePointer2 className="h-4 w-4" />Select / move
              </button>
              <button onClick={() => zone && setMode("draw")} disabled={!zone} aria-pressed={mode === "draw"} className={cn("inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-sm disabled:opacity-40", mode === "draw" ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>
                <PenLine className="h-4 w-4" />Add points
              </button>
            </div>
            {mode === "draw" && <button onClick={() => setMode("select")} className={ghostBtn}>Finish shape</button>}
            <button onClick={() => addZone("entry")} className={ghostBtn}><Plus className="h-4 w-4" />Entry zone</button>
            <button onClick={() => addZone("exit")} className={ghostBtn}><Plus className="h-4 w-4" />Exit zone</button>
            <select aria-label="Still image" value={d.stillImage} onChange={(e) => form.set("stillImage", e.target.value)} className={cn(field, "ml-auto")}>
              <option value="lobby">Still: demo lobby image</option>
              <option value="grid">Still: blank grid</option>
            </select>
          </div>
          <RoiEditor
            value={d} saved={saved} onChange={(v) => form.update(() => v)} mode={mode} setMode={setMode}
            selectedZoneId={selected} setSelectedZoneId={setSelected} stillSrc={stillLobby} invalidZoneIds={invalid} dirty={form.dirty}
          />
          <div className="flex flex-wrap items-center gap-4 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-entry/60" />Entry</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-exit/60" />Exit</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-gold" />Virtual line</span>
            {form.dirty && <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed border-muted-foreground" />Saved (before edits)</span>}
            <span className="ml-auto normal-case tracking-normal">Drag points · click a dashed midpoint to insert · Delete key removes the focused point</span>
          </div>
          {zoneErrors.length > 0 && (
            <Notice tone="danger" title="Fix before saving">
              <ul className="list-disc space-y-0.5 pl-5">{zoneErrors.map((e) => <li key={e}>{e}</li>)}</ul>
            </Notice>
          )}
          <WarningList warnings={form.warnings} />
        </div>

        <div className="space-y-4">
          <Panel title="Zones">
            {d.zones.length === 0 ? <p className="text-sm text-muted-foreground">No zones yet. Add an entry or exit zone.</p> : (
              <ul className="space-y-1">
                {d.zones.map((z) => (
                  <li key={z.id}>
                    <button onClick={() => { setSelected(z.id); setMode("select"); }} aria-pressed={z.id === selected}
                      className={cn("flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm", z.id === selected ? "border-primary/60 bg-primary/10" : "border-border hover:bg-accent")}>
                      <span className={cn("h-2.5 w-2.5 rounded-sm", z.kind === "entry" ? "bg-entry" : "bg-exit")} />
                      <span className="flex-1 truncate">{z.label || "Unnamed zone"}</span>
                      <span className={cn("font-mono text-[10px]", invalid.has(z.id) ? "text-destructive" : "text-muted-foreground")}>{z.points.length} pts{invalid.has(z.id) ? " · invalid" : ""}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {zone && (
            <Panel title="Selected zone">
              <div className="space-y-3">
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">Name</span>
                  <input value={zone.label} onChange={(e) => setZone({ ...zone, label: e.target.value })} maxLength={30} className={cn(field, "w-full")} />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">Zone type</span>
                  <select value={zone.kind} onChange={(e) => setZone({ ...zone, kind: e.target.value as "entry" | "exit" })} className={cn(field, "w-full")}>
                    <option value="entry">Entry zone</option>
                    <option value="exit">Exit zone</option>
                  </select>
                </label>
                <div>
                  <div className="mb-1 text-sm font-medium">Points (% of frame)</div>
                  {zone.points.length === 0 && <p className="text-xs text-muted-foreground">Use “Add points” and click on the image.</p>}
                  <ol className="max-h-56 space-y-1 overflow-y-auto pr-1">
                    {zone.points.map((p, i) => (
                      <li key={i} className="flex items-center gap-1.5 font-mono text-xs">
                        <span className="w-5 text-muted-foreground">{i + 1}</span>
                        {(["x", "y"] as const).map((k) => (
                          <input key={k} type="number" min={0} max={100} step={0.5} aria-label={`Point ${i + 1} ${k}`} value={Math.round(p[k] * 1000) / 10}
                            onChange={(e) => setZone(movePoint(zone, i, clampPoint({ ...p, [k]: Number(e.target.value) / 100 })))} className={cn(field, "h-7 w-20 px-1.5 text-xs")} />
                        ))}
                        <button onClick={() => setZone(deletePoint(zone, i))} aria-label={`Delete point ${i + 1}`} className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                      </li>
                    ))}
                  </ol>
                </div>
                <button onClick={() => setConfirm({ zone })} className={cn(ghostBtn, "w-full justify-center text-destructive")}><Trash2 className="h-4 w-4" />Delete zone</button>
              </div>
            </Panel>
          )}

          <Panel title="Virtual line" meta={<span className="font-mono text-[10px] uppercase text-muted-foreground">if backend supports it</span>}>
            <div className="space-y-3 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={d.line.enabled} onChange={(e) => form.set("line.enabled", e.target.checked)} className="accent-primary" />
                Use a virtual crossing line
              </label>
              <label className="block space-y-1">
                <span className="font-medium">Counted crossing direction</span>
                <select value={d.line.direction} disabled={!d.line.enabled} onChange={(e) => form.set("line.direction", e.target.value)} className={cn(field, "w-full")}>
                  <option value="left_to_right">A→B left side to right side</option>
                  <option value="right_to_left">A→B right side to left side</option>
                  <option value="both">Both directions</option>
                </select>
              </label>
              <p className="text-xs text-muted-foreground">Drag the gold A and B handles. The arrow shows which crossing counts.</p>
            </div>
          </Panel>

          <button onClick={() => setConfirm("reset")} className={cn(ghostBtn, "w-full justify-center")}><RotateCcw className="h-4 w-4" />Reset to default template</button>
        </div>
      </div>

      <SaveBar form={form} savedAt={meta?.lastSavedAt.roi} saveLabel="Save ROI" />

      <ConfirmDialog open={confirm === "reset"} onOpenChange={(o) => !o && setConfirm(null)} title="Reset to the default template?"
        description="This replaces all zones and the line in the editor with the demo template. Nothing is saved until you press Save ROI."
        confirmLabel="Reset" onConfirm={() => { const t = defaultRoi(d.cameraId, role); form.update(() => ({ ...t, stillImage: d.stillImage })); setSelected(t.zones[0]?.id ?? null); setMode("select"); }} />
      <ConfirmDialog open={typeof confirm === "object" && confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete ${typeof confirm === "object" && confirm ? confirm.zone.label : "zone"}?`} description="The zone is removed from the editor. Press Save ROI to keep the change." destructive confirmLabel="Delete zone"
        onConfirm={() => { if (typeof confirm === "object" && confirm) { form.update((x) => ({ ...x, zones: x.zones.filter((z) => z.id !== confirm.zone.id) })); setSelected(null); } }} />
    </>
  );
}
