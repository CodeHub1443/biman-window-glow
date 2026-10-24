import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { DemoTag } from "@/components/ops/ui";
import { SECTIONS, sectionFor } from "@/components/settings/sections";

export const Route = createFileRoute("/_ops/settings")({
  component: SettingsLayout,
});

function SettingsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const current = sectionFor(pathname);

  return (
    <div>
      <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        <Link to="/dashboard" className="hover:text-foreground">Operations</Link>
        <ChevronRight className="h-3 w-3" />
        {current ? <Link to="/settings" className="hover:text-foreground">Settings</Link> : <span aria-current="page" className="text-foreground">Settings</span>}
        {current && (<><ChevronRight className="h-3 w-3" /><span aria-current="page" className="text-foreground">{current.title}</span></>)}
      </nav>

      <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-border pb-5">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-primary">CFG · {current?.code ?? "Overview"}</div>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">{current?.title ?? "Settings"}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{current?.summary ?? "Configure the visitor greeting system. All values are demo configuration stored in this browser; no hardware is changed."}</p>
        </div>
        <DemoTag>Demo configuration · not applied to hardware</DemoTag>
      </header>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Settings sections" className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:sticky lg:top-20 lg:mx-0 lg:flex-col lg:self-start lg:overflow-visible lg:px-0">
          {SECTIONS.map((s) => (
            <Link
              key={s.id}
              to={s.to}
              className="group flex shrink-0 items-center gap-2.5 rounded-md border border-transparent px-3 py-2 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground data-[status=active]:border-border data-[status=active]:bg-card data-[status=active]:text-foreground"
            >
              <s.icon className="h-4 w-4 shrink-0 group-data-[status=active]:text-primary" />
              <span className="whitespace-nowrap">{s.title}</span>
              <span className="ml-auto hidden font-mono text-[9px] tracking-widest opacity-50 lg:inline">{s.code}</span>
            </Link>
          ))}
        </nav>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
