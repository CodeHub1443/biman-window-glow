import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Check, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { DemoTag, field, ghostBtn, PageError, PageSkeleton, Panel } from "@/components/ops/ui";
import { ConfirmDialog, Notice } from "@/components/settings/form";
import { SECTIONS, settingsHead } from "@/components/settings/sections";
import { settingsQueries, settingsService } from "@/lib/ops-queries";
import { ROLE_PERMISSIONS, validateOperators } from "@/lib/settings-logic";
import { cn } from "@/lib/utils";
import type { OperatorAccount, OperatorRole } from "@/types/settings";

export const Route = createFileRoute("/_ops/settings/access")({
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(settingsQueries.operators()), context.queryClient.ensureQueryData(settingsQueries.audit())]).then(() => undefined),
  head: () => settingsHead("Access & Audit", "Frontend prototype of operator roles, permissions and the settings change history."),
  pendingComponent: PageSkeleton,
  errorComponent: ({ error }) => <PageError error={error} />,
  component: AccessPage,
});

const ROLES = Object.keys(ROLE_PERMISSIONS) as OperatorRole[];
const ALL_PERMS = [...new Set(ROLES.flatMap((r) => ROLE_PERMISSIONS[r].can))];
const sectionTitle = (s: string) => SECTIONS.find((x) => x.id === s)?.title ?? (s === "system" ? "System" : s);

type Pending = { list: OperatorAccount[]; action: string; title: string; description: string; destructive?: boolean };

function AccessPage() {
  const { data: operators } = useSuspenseQuery(settingsQueries.operators());
  const { data: audit } = useSuspenseQuery(settingsQueries.audit());
  const qc = useQueryClient();
  const [pending, setPending] = useState<Pending | null>(null);
  const [adding, setAdding] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", role: "viewer" as OperatorRole });
  const [resetOpen, setResetOpen] = useState(false);
  const [resetText, setResetText] = useState("");
  const [filter, setFilter] = useState("all");

  const save = useMutation({
    mutationFn: (p: { list: OperatorAccount[]; action: string }) => settingsService.saveOperators(p.list, p.action),
    onSuccess: (_v, p) => { void qc.invalidateQueries({ queryKey: ["settings"] }); toast.success(p.action, { description: "Prototype only — no real account was changed." }); },
    onError: (e) => toast.error("Not saved", { description: e.message }),
  });
  const reset = useMutation({
    mutationFn: () => settingsService.resetAll(),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["settings"] }); toast.success("All settings reset to demo defaults"); setResetText(""); },
    onError: (e) => toast.error("Reset failed", { description: e.message }),
  });

  // Sensitive changes go through a confirmation step; rules are checked before asking.
  const propose = (p: Pending) => {
    const err = validateOperators(p.list);
    if (err) return toast.error("Change not allowed", { description: err });
    setPending(p);
  };

  const addError = newUser.username ? validateOperators([...operators, { id: "new", username: newUser.username, role: newUser.role, active: true, lastActiveAt: null }]) : null;
  const entries = audit.filter((a) => filter === "all" || a.section === filter);

  return (
    <div className="space-y-5">
      <Notice tone="warning" title="Frontend prototype · no sign-in or access control yet">
        Operator accounts, roles and permissions shown here are demo records. Nobody signs in and no permission is enforced until the backend provides authentication.
      </Notice>

      <Panel title="Operator accounts" meta={<button onClick={() => setAdding(true)} className={ghostBtn}><Plus className="h-4 w-4" />Add operator</button>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr><th className="py-2 font-normal">Username</th><th className="font-normal">Role</th><th className="font-normal">Active</th><th className="font-normal">Last active</th><th /></tr>
            </thead>
            <tbody className="divide-y divide-border">
              {operators.map((o) => (
                <tr key={o.id}>
                  <td className="py-2.5 font-mono">{o.username} <DemoTag className="ml-1">demo</DemoTag></td>
                  <td>
                    <select aria-label={`Role for ${o.username}`} value={o.role} className={field}
                      onChange={(e) => {
                        const role = e.target.value as OperatorRole;
                        propose({ list: operators.map((x) => (x.id === o.id ? { ...x, role } : x)), action: `Changed ${o.username} role to ${ROLE_PERMISSIONS[role].label}`,
                          title: `Change ${o.username} to ${ROLE_PERMISSIONS[role].label}?`, description: `They would be able to: ${ROLE_PERMISSIONS[role].can.join(", ")}.` });
                      }}>
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_PERMISSIONS[r].label}</option>)}
                    </select>
                  </td>
                  <td>
                    <Switch checked={o.active} aria-label={`${o.active ? "Deactivate" : "Activate"} ${o.username}`}
                      onCheckedChange={(v) => propose({ list: operators.map((x) => (x.id === o.id ? { ...x, active: v } : x)), action: `${v ? "Activated" : "Deactivated"} ${o.username}`,
                        title: `${v ? "Activate" : "Deactivate"} ${o.username}?`, description: v ? "The account would be able to sign in once authentication exists." : "The account would no longer be able to sign in.", destructive: !v })} />
                  </td>
                  <td className="font-mono text-xs text-muted-foreground">{o.lastActiveAt ? new Date(o.lastActiveAt).toLocaleString([], { dateStyle: "short", timeStyle: "short", hour12: false }) : "never"}</td>
                  <td className="text-right">
                    <button aria-label={`Remove ${o.username}`} className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                      onClick={() => propose({ list: operators.filter((x) => x.id !== o.id), action: `Removed operator ${o.username}`, title: `Remove ${o.username}?`, description: "The demo account is deleted. This cannot be undone.", destructive: true })}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {adding && (
          <form className="mt-4 flex flex-wrap items-end gap-3 rounded-md border border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (addError || !newUser.username) return;
              const id = `OP-${Date.now().toString(36)}`;
              save.mutate({ list: [...operators, { id, username: newUser.username.trim().toLowerCase(), role: newUser.role, active: true, lastActiveAt: null }], action: `Added operator ${newUser.username}` });
              setNewUser({ username: "", role: "viewer" });
              setAdding(false);
            }}>
            <label className="space-y-1 text-sm"><span className="block font-medium">Username</span>
              <input value={newUser.username} onChange={(e) => setNewUser((u) => ({ ...u, username: e.target.value }))} maxLength={32} placeholder="e.g. desk.operator" className={cn(field, "w-56")} aria-invalid={!!addError} />
            </label>
            <label className="space-y-1 text-sm"><span className="block font-medium">Role</span>
              <select value={newUser.role} onChange={(e) => setNewUser((u) => ({ ...u, role: e.target.value as OperatorRole }))} className={field}>
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_PERMISSIONS[r].label}</option>)}
              </select>
            </label>
            <button type="submit" disabled={!newUser.username || !!addError} className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-40">Add</button>
            <button type="button" onClick={() => setAdding(false)} className={ghostBtn}>Cancel</button>
            {addError && <p className="w-full text-xs text-destructive">{addError}</p>}
          </form>
        )}
      </Panel>

      <Panel title="Permission summary">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr><th className="py-2 text-left font-normal">Permission</th>{ROLES.map((r) => <th key={r} className="font-normal">{ROLE_PERMISSIONS[r].label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ALL_PERMS.map((p) => (
                <tr key={p}>
                  <td className="py-2">{p}</td>
                  {ROLES.map((r) => (
                    <td key={r} className="text-center">
                      {ROLE_PERMISSIONS[r].can.includes(p) ? <Check className="mx-auto h-4 w-4 text-primary" aria-label="allowed" /> : <X className="mx-auto h-4 w-4 text-muted-foreground/50" aria-label="not allowed" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Settings change history" meta={
        <select aria-label="Filter by section" value={filter} onChange={(e) => setFilter(e.target.value)} className={field}>
          <option value="all">All sections</option>
          {SECTIONS.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
          <option value="system">System</option>
        </select>
      }>
        {entries.length === 0 ? <p className="text-sm text-muted-foreground">No changes recorded for this section.</p> : (
          <ol className="divide-y divide-border">
            {entries.map((a) => (
              <li key={a.id} className="py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                  <time className="font-mono text-xs text-muted-foreground" dateTime={new Date(a.at).toISOString()}>{new Date(a.at).toLocaleString([], { dateStyle: "medium", timeStyle: "medium", hour12: false })}</time>
                  <span className="font-medium">{a.action}</span>
                  <span className="rounded-sm border border-border px-1.5 font-mono text-[10px] uppercase text-muted-foreground">{sectionTitle(a.section)}</span>
                  <span className="ml-auto font-mono text-xs text-muted-foreground">by {a.actor} (demo)</span>
                </div>
                {a.changes.length > 0 && (
                  <ul className="mt-1 space-y-0.5 font-mono text-[11px] text-muted-foreground">
                    {a.changes.slice(0, 6).map((c, i) => <li key={i} className="truncate">· {c}</li>)}
                    {a.changes.length > 6 && <li>· +{a.changes.length - 6} more</li>}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        )}
      </Panel>

      <Panel title="Sensitive actions">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-medium">Reset all settings to demo defaults</div>
            <p className="text-sm text-muted-foreground">Restores every section, removes added cameras and clears in-memory camera passwords.</p>
          </div>
          <button onClick={() => setResetOpen(true)} className={cn(ghostBtn, "border-destructive/50 text-destructive")}><RotateCcw className="h-4 w-4" />Reset everything</button>
        </div>
      </Panel>

      <ConfirmDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)} title={pending?.title ?? ""} description={pending?.description ?? ""}
        confirmLabel="Confirm" destructive={pending?.destructive} onConfirm={() => pending && save.mutate({ list: pending.list, action: pending.action })} />
      <ConfirmDialog open={resetOpen} onOpenChange={(o) => { setResetOpen(o); if (!o) setResetText(""); }} title="Reset all settings?" destructive confirmLabel="Reset everything"
        confirmDisabled={resetText !== "RESET"} onConfirm={() => reset.mutate()}
        description="This cannot be undone. Type RESET to confirm.">
        <input value={resetText} onChange={(e) => setResetText(e.target.value)} aria-label="Type RESET to confirm" className={cn(field, "w-full font-mono")} placeholder="RESET" />
      </ConfirmDialog>
    </div>
  );
}
