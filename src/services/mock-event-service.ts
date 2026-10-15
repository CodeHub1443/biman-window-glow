/**
 * Event source boundary. The real backend adapter will implement VisitorEventSource
 * with the same subscribe() contract; components never import mock data directly.
 */
import face1 from "@/assets/demo-face-1.jpg";
import face2 from "@/assets/demo-face-2.jpg";

export type VisitorEventType = "ENTRY" | "EXIT";

export interface VisitorEvent {
  id: string;
  type: VisitorEventType;
  timestamp: string; // ISO
  stationLabel: string;
  cameraLabel?: string;
  faceImageUrl?: string | undefined;
  isDemo?: boolean;
}

export interface VisitorEventSource {
  subscribe(cb: (e: VisitorEvent) => void): () => void;
}

const CHANNEL = "biman-visitor-events";
const demoFaces = [face1, face2];

class MockEventService implements VisitorEventSource {
  private listeners = new Set<(e: VisitorEvent) => void>();
  private channel: BroadcastChannel | null = null;

  private ensureChannel() {
    if (this.channel || typeof window === "undefined" || !("BroadcastChannel" in window)) return;
    this.channel = new BroadcastChannel(CHANNEL);
    this.channel.onmessage = (m) => this.listeners.forEach((l) => l(m.data as VisitorEvent));
  }

  subscribe(cb: (e: VisitorEvent) => void) {
    this.ensureChannel();
    this.listeners.add(cb);
    return () => void this.listeners.delete(cb);
  }

  emit(e: VisitorEvent) {
    this.ensureChannel();
    this.listeners.forEach((l) => l(e));
    this.channel?.postMessage(e); // also drives a kiosk window open in another tab
  }

  createDemoEvent(type: VisitorEventType, opts: { noFace?: boolean } = {}): VisitorEvent {
    const n = Math.floor(Math.random() * demoFaces.length);
    return {
      id: `demo-${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      timestamp: new Date().toISOString(),
      stationLabel: type === "ENTRY" ? "Station 1 · Main Entrance" : "Station 2 · Main Exit",
      cameraLabel: type === "ENTRY" ? "CAM-E1" : "CAM-X1",
      faceImageUrl: opts.noFace ? undefined : demoFaces[n],
      isDemo: true,
    };
  }
}

export const mockEventService = new MockEventService();
