import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { PageError, PageSkeleton } from "@/components/ops/ui";
import { SECTIONS, settingsHead } from "@/components/settings/sections";
import { settingsQueries } from "@/lib/ops-queries";

export const Route = createFileRoute("/_ops/settings/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(settingsQueries.meta()).then(() => undefined),
  head: () => settingsHead("Overview", "All configuration sections for the Biman visitor greeting system, with last-saved times."),
  pendingComponent: PageSkeleton,
  errorComponent: ({ error }) => <PageError error={error} />,
  component: SettingsOverview,
});

function SettingsOverview() {
  const { data: meta } = useSuspenseQuery(settingsQueries.meta());
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {SECTIONS.map((s) => {
        const at = meta.lastSavedAt[s.id];
        return (
          <li key={s.id}>
            <Link to={s.to} className="group flex h-full flex-col rounded-lg border border-border bg-card p-4 transition hover:border-primary/50">
              <div className="flex items-center gap-2">
                <s.icon className="h-4 w-4 text-primary" />
                <span className="font-medium">{s.title}</span>
                <span className="ml-auto font-mono text-[9px] tracking-widest text-muted-foreground">{s.code}</span>
              </div>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{s.summary}</p>
              <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <span>{at ? `Saved ${new Date(at).toLocaleString([], { dateStyle: "medium", timeStyle: "short", hour12: false })}` : s.id === "debug" ? "No saved settings" : "Demo defaults"}</span>
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
