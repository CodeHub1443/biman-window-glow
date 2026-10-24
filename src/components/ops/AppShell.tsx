import { Link } from "@tanstack/react-router";
import { Activity, ChevronsLeft, ChevronsRight, LayoutDashboard, ListOrdered, Menu, Moon, Plane, Settings, Sun, Timer } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useTheme } from "@/components/ThemeProvider";
import { formatTime } from "@/lib/ops-data";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { DemoTag } from "./ui";

const NAV = [
  { to: "/", label: "Visitor Display", icon: Plane, code: "VD" },
  { to: "/dashboard", label: "Operations Dashboard", icon: LayoutDashboard, code: "OPS" },
  { to: "/events", label: "Visitor Events", icon: ListOrdered, code: "EVT" },
  { to: "/analytics", label: "Dwell Time Analytics", icon: Timer, code: "DWL" },
  { to: "/health", label: "System Health", icon: Activity, code: "SYS" },
  { to: "/settings", label: "Settings", icon: Settings, code: "CFG" },
] as const;

/** Logo slot for the operations shell. Replace with the official Biman logo when supplied. */
function LogoSlot({ compact }: { compact: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div aria-label="Biman logo placeholder" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-dashed border-muted-foreground/50 text-center font-mono text-[7px] uppercase leading-tight tracking-wider text-muted-foreground">
        Logo<br />slot
      </div>
      {!compact && (
        <div className="leading-tight">
          <div className="font-display text-sm font-semibold">Biman Bangladesh</div>
          <div className="font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground">Visitor operations</div>
        </div>
      )}
    </div>
  );
}

function NavList({ compact, onNavigate }: { compact: boolean; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon, code }) => (
        <Link
          key={to}
          to={to}
          onClick={onNavigate}
          title={compact ? label : undefined}
          activeOptions={{ exact: to === "/" }}
          className="group relative flex h-10 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground data-[status=active]:bg-primary/12 data-[status=active]:text-foreground"
        >
          <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary opacity-0 group-data-[status=active]:opacity-100" />
          <Icon className="h-4 w-4 shrink-0 group-data-[status=active]:text-primary" />
          {!compact && (
            <>
              <span className="flex-1 truncate">{label}</span>
              <span className="font-mono text-[9px] tracking-widest opacity-50">{code}</span>
            </>
          )}
        </Link>
      ))}
    </nav>
  );
}

function Clock() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);
  return <span className="font-mono text-xs tabular-nums text-muted-foreground">DAC {now ? formatTime(now) : "--:--"} · UTC+6</span>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const [compact, setCompact] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggle } = useTheme();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className={cn("sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-card/60 p-3 transition-[width] md:flex", compact ? "w-[68px]" : "w-64")}>
        <div className="mb-6 px-1 pt-1"><LogoSlot compact={compact} /></div>
        <NavList compact={compact} />
        <button
          onClick={() => setCompact((c) => !c)}
          aria-label={compact ? "Expand navigation" : "Collapse navigation"}
          className="mt-auto flex h-9 items-center justify-center gap-2 rounded-md text-xs text-muted-foreground hover:bg-accent"
        >
          {compact ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" />Collapse</>}
        </button>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 p-4">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="mb-6"><LogoSlot compact={false} /></div>
          <NavList compact={false} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur md:px-8">
          <button className="rounded-md p-2 hover:bg-accent md:hidden" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu className="h-5 w-5" /></button>
          <div className="md:hidden"><LogoSlot compact /></div>
          <div className="ml-auto flex items-center gap-3">
            <DemoTag className="hidden sm:inline-flex">Demo data · no hardware connected</DemoTag>
            <Clock />
            <button onClick={toggle} aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} className="rounded-md border border-border p-2 hover:bg-accent">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
      <Toaster theme={theme} position="bottom-right" richColors closeButton />
    </div>
  );
}
