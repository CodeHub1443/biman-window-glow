import { useRouter } from "@tanstack/react-router";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { AlertTriangle, Inbox, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { HealthStatus, ProcessingStatus } from "@/types/operations";

export function DemoTag({ children = "Demo data", className }: { children?: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-sm border border-gold/50 bg-gold/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground", className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-gold" />
      {children}
    </span>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div>
        <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary">{eyebrow}</div>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({ title, meta, children, className }: { title?: string; meta?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-lg border border-border bg-card p-5 text-card-foreground", className)}>
      {(title || meta) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.25em] text-muted-foreground">{title}</h2>}
          {meta}
        </div>
      )}
      {children}
    </section>
  );
}

const healthDot: Record<string, string> = { online: "bg-primary", degraded: "bg-gold", offline: "bg-destructive", unused: "bg-muted-foreground/40" };
export function StatusPill({ status }: { status: HealthStatus | "unused" }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider">
      <span className={cn("h-2 w-2 rounded-full", healthDot[status], status === "offline" && "animate-blink")} />
      {status}
    </span>
  );
}

const procLabel: Record<ProcessingStatus, string> = { processed: "Processed", pending: "Pending", failed: "Failed", no_face: "No face" };
const procCls: Record<ProcessingStatus, string> = {
  processed: "border-primary/40 text-primary",
  pending: "border-gold/50 text-foreground",
  failed: "border-destructive/50 text-destructive",
  no_face: "border-border text-muted-foreground",
};
export function ProcessingBadge({ status }: { status: ProcessingStatus }) {
  return <span className={cn("rounded-sm border px-1.5 py-0.5 font-mono text-[11px] uppercase", procCls[status])}>{procLabel[status]}</span>;
}

export function TypeTag({ type }: { type: "ENTRY" | "EXIT" }) {
  return (
    <span className={cn("rounded-sm px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-wider", type === "ENTRY" ? "bg-entry/20 text-foreground ring-1 ring-entry/60" : "bg-exit/20 text-foreground ring-1 ring-exit/60")}>
      {type}
    </span>
  );
}

export function FaceThumb({ src, size = 40 }: { src?: string | undefined; size?: number }) {
  return src ? (
    <img src={src} alt="Captured face (demo)" width={size} height={size} className="rounded-md object-cover ring-1 ring-border" style={{ width: size, height: size }} />
  ) : (
    <div className="flex items-center justify-center rounded-md bg-muted font-mono text-[9px] uppercase text-muted-foreground ring-1 ring-border" style={{ width: size, height: size }}>
      No face
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
      <Inbox className="h-8 w-8 text-muted-foreground" />
      <div className="font-medium">{title}</div>
      {hint && <div className="text-sm text-muted-foreground">{hint}</div>}
      {action}
    </div>
  );
}

export function PageError({ error }: { error: unknown }) {
  const router = useRouter();
  const qr = useQueryErrorResetBoundary();
  return (
    <div role="alert" className="mx-auto mt-16 max-w-md rounded-lg border border-destructive/40 bg-card p-6 text-center">
      <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
      <div className="mt-2 font-semibold">This data couldn't load</div>
      <div className="mt-1 text-sm text-muted-foreground">{error instanceof Error ? error.message : "Unknown error"}</div>
      <button onClick={() => { qr.reset(); router.invalidate(); }} className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
        <RotateCcw className="h-4 w-4" /> Retry
      </button>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse space-y-4">
      <div className="h-8 w-64 rounded bg-muted" />
      <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-32 rounded-lg bg-muted" />)}</div>
      <div className="h-72 rounded-lg bg-muted" />
    </div>
  );
}

export const field = "h-9 rounded-md border border-input bg-background px-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";
export const ghostBtn = "inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-medium transition hover:bg-accent disabled:opacity-40";

export const chartTooltip = {
  contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--popover-foreground)", fontSize: 12 },
  labelStyle: { color: "var(--muted-foreground)" },
  cursor: { fill: "var(--accent)", opacity: 0.4 },
};
export const axis = { stroke: "var(--muted-foreground)", fontSize: 11, tickLine: false, axisLine: false } as const;
