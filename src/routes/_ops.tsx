import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/ops/AppShell";

// Operations pages render in the browser only: demo data is generated from the visitor's clock.
export const Route = createFileRoute("/_ops")({
  ssr: false,
  component: OpsLayout,
});

function OpsLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
