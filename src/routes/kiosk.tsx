import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { VisitorDisplay } from "@/components/VisitorDisplay";
import { useDisplayConfig } from "@/hooks/use-display-config";
import { useVisitorDisplay } from "@/hooks/use-visitor-display";
import { mockEventService } from "@/services/mock-event-service";

export const Route = createFileRoute("/kiosk")({
  head: () => ({
    meta: [
      { title: "Kiosk — Biman Visitor Display" },
      { name: "description", content: "Full-screen kiosk presentation of the Biman visitor greeting display." },
      { property: "og:title", content: "Kiosk — Biman Visitor Display" },
      { property: "og:description", content: "Full-screen kiosk presentation of the Biman visitor greeting display." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Kiosk,
});

function Kiosk() {
  const { config } = useDisplayConfig();
  const { state } = useVisitorDisplay(mockEventService, config.greetingDurationMs);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === "Escape") navigate({ to: "/" }); // dev exit
      if (e.key === "f") document.documentElement.requestFullscreen?.().catch(() => {});
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  return (
    <div className="h-screen w-screen cursor-none">
      <VisitorDisplay state={state} config={config} />
    </div>
  );
}
