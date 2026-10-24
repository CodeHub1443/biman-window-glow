import { useBlocker } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, CircleDot, Loader2, RotateCcw, XCircle } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { field } from "@/components/ops/ui";
import type { SaveStatus, SectionForm } from "@/hooks/use-section-form";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------ field wrapper */

export function Field({
  label, hint, error, dirty, onReset, children, id, demo, className,
}: {
  label: string; hint?: ReactNode; error?: string | undefined; dirty?: boolean; onReset?: () => void;
  children: (id: string, describedBy: string | undefined) => ReactNode; id?: string; demo?: boolean; className?: string;
}) {
  const auto = useId();
  const fid = id ?? auto;
  const hintId = hint ? `${fid}-hint` : undefined;
  const errId = error ? `${fid}-err` : undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex min-h-5 items-center gap-2">
        <label htmlFor={fid} className="text-sm font-medium">{label}</label>
        {demo && <span className="rounded-sm border border-gold/50 px-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">demo placeholder</span>}
        {dirty && (
          <span className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-gold">
            <CircleDot className="h-3 w-3" /> changed
            {onReset && (
              <button type="button" onClick={onReset} className="ml-1 rounded px-1 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" aria-label={`Reset ${label} to saved value`}>
                reset
              </button>
            )}
          </span>
        )}
      </div>
      {children(fid, [hintId, errId].filter(Boolean).join(" ") || undefined)}
      {error ? (
        <p id={errId} role="alert" className="flex items-center gap-1 text-xs text-destructive"><XCircle className="h-3.5 w-3.5 shrink-0" />{error}</p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Binds a Field to a form path: dirty marker, reset-to-saved, and error come for free. */
export function bind<T>(form: SectionForm<T>, path: string) {
  return { error: form.errorFor(path), dirty: form.isFieldDirty(path), onReset: () => form.resetField(path) };
}

export const inputCls = (error?: string) => cn(field, "w-full", error && "border-destructive focus:ring-destructive");

export function TextField<T>({ form, path, label, hint, placeholder, demo, type = "text", autoComplete }: {
  form: SectionForm<T>; path: string; label: string; hint?: ReactNode; placeholder?: string; demo?: boolean; type?: string; autoComplete?: string;
}) {
  const b = bind(form, path);
  const value = (path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], form.draft) ?? "") as string;
  return (
    <Field label={label} hint={hint} demo={demo} {...b}>
      {(id, d) => (
        <input id={id} type={type} value={value} placeholder={placeholder} autoComplete={autoComplete} aria-invalid={!!b.error} aria-describedby={d}
          onChange={(e) => form.set(path, e.target.value)} className={inputCls(b.error)} />
      )}
    </Field>
  );
}

export function NumberField<T>({ form, path, label, hint, min, max, step = 1, unit, scale = 1 }: {
  form: SectionForm<T>; path: string; label: string; hint?: ReactNode; min: number; max: number; step?: number; unit?: string; scale?: number;
}) {
  const b = bind(form, path);
  const raw = path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], form.draft) as number;
  return (
    <Field label={label} hint={hint} {...b}>
      {(id, d) => (
        <div className="flex items-center gap-2">
          <input id={id} type="number" inputMode="decimal" min={min / scale} max={max / scale} step={step} value={Number.isFinite(raw) ? raw / scale : ""}
            aria-invalid={!!b.error} aria-describedby={d}
            onChange={(e) => form.set(path, e.target.value === "" ? Number.NaN : Number(e.target.value) * scale)} className={cn(inputCls(b.error), "max-w-40 font-mono tabular-nums")} />
          {unit && <span className="font-mono text-xs text-muted-foreground">{unit}</span>}
        </div>
      )}
    </Field>
  );
}

export function RangeField<T>({ form, path, label, hint, min, max, step, format }: {
  form: SectionForm<T>; path: string; label: string; hint?: ReactNode; min: number; max: number; step: number; format: (v: number) => string;
}) {
  const b = bind(form, path);
  const v = path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], form.draft) as number;
  return (
    <Field label={label} hint={hint} {...b}>
      {(id, d) => (
        <div className="flex items-center gap-3">
          <input id={id} type="range" min={min} max={max} step={step} value={v} aria-describedby={d} aria-valuetext={format(v)}
            onChange={(e) => form.set(path, Number(e.target.value))} className="w-full accent-primary" />
          <span className="w-16 text-right font-mono text-sm tabular-nums">{format(v)}</span>
        </div>
      )}
    </Field>
  );
}

export function SelectField<T>({ form, path, label, hint, options, demo }: {
  form: SectionForm<T>; path: string; label: string; hint?: ReactNode; options: { value: string; label: string; disabled?: boolean }[]; demo?: boolean;
}) {
  const b = bind(form, path);
  const v = path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], form.draft) as string;
  return (
    <Field label={label} hint={hint} demo={demo} {...b}>
      {(id, d) => (
        <select id={id} value={v} aria-invalid={!!b.error} aria-describedby={d} onChange={(e) => form.set(path, e.target.value)} className={inputCls(b.error)}>
          {options.map((o) => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
        </select>
      )}
    </Field>
  );
}

export function ToggleField<T>({ form, path, label, hint }: { form: SectionForm<T>; path: string; label: string; hint?: ReactNode }) {
  const b = bind(form, path);
  const v = Boolean(path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], form.draft));
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
      <div>
        <label htmlFor={id} className="text-sm font-medium">{label}</label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        {b.dirty && (
          <button type="button" onClick={b.onReset} className="mt-1 font-mono text-[10px] uppercase tracking-wider text-gold hover:underline">changed · reset</button>
        )}
      </div>
      <Switch id={id} checked={v} onCheckedChange={(c) => form.set(path, c)} />
    </div>
  );
}

/* ------------------------------------------------------------ save status + bar */

const STATUS: Record<SaveStatus, { label: string; icon: typeof CheckCircle2; cls: string }> = {
  saved: { label: "All changes saved", icon: CheckCircle2, cls: "text-primary" },
  dirty: { label: "Unsaved changes", icon: CircleDot, cls: "text-gold" },
  invalid: { label: "Fix errors to save", icon: XCircle, cls: "text-destructive" },
  saving: { label: "Saving…", icon: Loader2, cls: "text-muted-foreground" },
  error: { label: "Save failed", icon: AlertTriangle, cls: "text-destructive" },
};

export function SaveStatusChip({ status, savedAt }: { status: SaveStatus; savedAt?: number | undefined }) {
  const s = STATUS[status];
  const Icon = s.icon;
  return (
    <span role="status" aria-live="polite" className={cn("inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider", s.cls)}>
      <Icon className={cn("h-3.5 w-3.5", status === "saving" && "animate-spin")} />
      {s.label}
      {status === "saved" && savedAt && (
        <span className="text-muted-foreground">· {new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
      )}
    </span>
  );
}

export function SaveBar<T>({ form, savedAt, saveLabel = "Save changes" }: { form: SectionForm<T>; savedAt?: number | undefined; saveLabel?: string }) {
  const [confirm, setConfirm] = useState(false);
  const errorCount = Object.keys(form.errors).length;
  const onSave = async () => {
    const r = await form.submit();
    if (r === "needs-confirm") setConfirm(true);
  };
  return (
    <>
      <div className="sticky bottom-0 z-20 -mx-4 mt-6 flex flex-wrap items-center gap-3 border-t border-border bg-background/90 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <SaveStatusChip status={form.status} savedAt={savedAt} />
        {form.dirty && errorCount > 0 && <span className="text-xs text-destructive">{errorCount} field{errorCount > 1 ? "s" : ""} need attention</span>}
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={form.cancel} disabled={!form.dirty || form.status === "saving"} className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium transition hover:bg-accent disabled:opacity-40">
            <RotateCcw className="h-4 w-4" /> Cancel
          </button>
          <button type="button" onClick={onSave} disabled={!form.dirty || form.status === "saving"} className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-40">
            {form.status === "saving" && <Loader2 className="h-4 w-4 animate-spin" />}{saveLabel}
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Save with warnings?"
        description={<ul className="list-disc space-y-1 pl-5">{form.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
        confirmLabel="Save anyway"
        onConfirm={() => void form.submit({ confirmed: true })}
      />
      <UnsavedChangesGuard when={form.dirty} />
    </>
  );
}

/* ------------------------------------------------------------ dialogs */

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm, destructive, children, confirmDisabled }: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description: ReactNode; confirmLabel: string;
  onConfirm: () => void; destructive?: boolean; children?: ReactNode; confirmDisabled?: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild><div className="text-sm text-muted-foreground">{description}</div></AlertDialogDescription>
        </AlertDialogHeader>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={confirmDisabled} onClick={onConfirm} className={cn(destructive && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Blocks in-app navigation and tab close while `when` is true, with a confirm dialog. */
export function UnsavedChangesGuard({ when }: { when: boolean }) {
  const blocker = useBlocker({ shouldBlockFn: () => when, enableBeforeUnload: () => when, withResolver: true });
  return (
    <AlertDialog open={blocker.status === "blocked"} onOpenChange={(o) => !o && blocker.reset?.()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
          <AlertDialogDescription>You have unsaved changes on this page. If you leave now they will be discarded.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => blocker.reset?.()}>Stay on page</AlertDialogCancel>
          <AlertDialogAction onClick={() => blocker.proceed?.()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Discard changes</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function Notice({ tone = "info", children, title }: { tone?: "info" | "warning" | "danger"; children: ReactNode; title?: string }) {
  return (
    <div className={cn(
      "rounded-md border px-3 py-2.5 text-sm",
      tone === "info" && "border-border bg-muted/40 text-muted-foreground",
      tone === "warning" && "border-gold/50 bg-gold/10 text-foreground",
      tone === "danger" && "border-destructive/50 bg-destructive/10 text-foreground",
    )}>
      {title && <div className="mb-0.5 font-medium text-foreground">{title}</div>}
      {children}
    </div>
  );
}

export function WarningList({ warnings }: { warnings: string[] }) {
  if (!warnings.length) return null;
  return (
    <Notice tone="warning" title="Check before saving">
      <ul className="list-disc space-y-0.5 pl-5">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
    </Notice>
  );
}
