import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { PageHeader, Panel } from "@/components/ops/ui";

export const Route = createFileRoute("/_ops/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Biman Visitor Operations" },
      { name: "description", content: "System settings for the Biman visitor greeting system (coming in Phase 3)." },
      { property: "og:title", content: "Settings — Biman Visitor Operations" },
      { property: "og:description", content: "System settings for the Biman visitor greeting system (coming in Phase 3)." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

const SECTIONS = ["General", "Camera Configuration", "ROI Editor", "Debug Preview", "Greeting & Audio", "Detection & Events", "Device & Network", "Visitor Display", "Access & Audit"];

function SettingsPage() {
  return (
    <>
      <PageHeader eyebrow="CFG · Configuration" title="Settings" description="The settings workspace is planned for Phase 3. Nothing here is connected yet." />
      <Panel>
        <div className="flex items-center gap-3 text-muted-foreground"><Settings className="h-5 w-5" /> Coming in Phase 3</div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SECTIONS.map((s) => (
            <li key={s} className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">{s}</li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
