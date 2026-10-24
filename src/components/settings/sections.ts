import { Camera, Cctv, Gauge, MonitorPlay, Network, ScanSearch, ShieldCheck, SlidersHorizontal, Volume2, type LucideIcon } from "lucide-react";
import type { SettingsSection } from "@/types/settings";

export interface SectionInfo {
  id: SettingsSection;
  to:
    | "/settings/general" | "/settings/cameras" | "/settings/roi" | "/settings/debug" | "/settings/audio"
    | "/settings/detection" | "/settings/devices" | "/settings/display" | "/settings/access";
  title: string;
  code: string;
  icon: LucideIcon;
  summary: string;
}

export const SECTIONS: SectionInfo[] = [
  { id: "general", to: "/settings/general", title: "General Settings", code: "GEN", icon: SlidersHorizontal, summary: "System name, station labels, time, theme and data retention." },
  { id: "cameras", to: "/settings/cameras", title: "Camera Configuration", code: "CAM", icon: Camera, summary: "Add, edit and test the four planned cameras and their RTSP settings." },
  { id: "roi", to: "/settings/roi", title: "ROI Editor", code: "ROI", icon: ScanSearch, summary: "Draw entry and exit zones and a virtual crossing line per camera." },
  { id: "debug", to: "/settings/debug", title: "Debug Preview", code: "DBG", icon: Cctv, summary: "The only place a camera preview may appear. Started manually." },
  { id: "audio", to: "/settings/audio", title: "Greeting & Audio", code: "AUD", icon: Volume2, summary: "Welcome and goodbye sounds, volume and speaker per station." },
  { id: "detection", to: "/settings/detection", title: "Detection & Events", code: "DET", icon: Gauge, summary: "Detection thresholds, event confirmation, cooldown and dwell policy." },
  { id: "devices", to: "/settings/devices", title: "Device & Network", code: "NET", icon: Network, summary: "Station device assignments, backend placeholders and diagnostics." },
  { id: "display", to: "/settings/display", title: "Visitor Display", code: "VD", icon: MonitorPlay, summary: "Idle video, fallback image, headlines, motion and live preview." },
  { id: "access", to: "/settings/access", title: "Access & Audit", code: "ACL", icon: ShieldCheck, summary: "Operator roles, permissions and the settings change history." },
];

export const sectionFor = (pathname: string) => SECTIONS.find((s) => pathname === s.to || pathname.startsWith(`${s.to}/`));

export function settingsHead(title: string, description: string) {
  const t = `${title} — Settings — Biman Visitor Operations`;
  return {
    meta: [
      { title: t },
      { name: "description", content: description },
      { property: "og:title", content: t },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  };
}
