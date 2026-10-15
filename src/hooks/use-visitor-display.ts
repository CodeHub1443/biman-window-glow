import { useCallback, useEffect, useRef, useState } from "react";
import type { VisitorEvent, VisitorEventSource } from "@/services/mock-event-service";

const EXIT_ANIM_MS = 600;
const MAX_QUEUE = 20;
const MAX_SEEN = 500;

export interface DisplayState {
  current: VisitorEvent | null;
  leaving: boolean;
  queueLength: number;
  suppressed: number;
}

/** Entry/exit state machine: FIFO queue, duplicate-ID suppression, timed return to idle. */
export function useVisitorDisplay(source: VisitorEventSource, durationMs: number) {
  const [current, setCurrent] = useState<VisitorEvent | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [queueLength, setQueueLength] = useState(0);
  const [suppressed, setSuppressed] = useState(0);
  const queue = useRef<VisitorEvent[]>([]);
  const seen = useRef<string[]>([]);
  const currentRef = useRef<VisitorEvent | null>(null);

  const advance = useCallback(() => {
    const next = queue.current.shift() ?? null;
    currentRef.current = next;
    setCurrent(next);
    setLeaving(false);
    setQueueLength(queue.current.length);
  }, []);

  const enqueue = useCallback(
    (e: VisitorEvent) => {
      if (seen.current.includes(e.id)) {
        setSuppressed((s) => s + 1);
        return;
      }
      seen.current.push(e.id);
      if (seen.current.length > MAX_SEEN) seen.current.shift();
      if (!currentRef.current) {
        currentRef.current = e;
        setCurrent(e);
        setLeaving(false);
      } else {
        queue.current.push(e);
        if (queue.current.length > MAX_QUEUE) queue.current.shift();
        setQueueLength(queue.current.length);
      }
    },
    [],
  );

  useEffect(() => source.subscribe(enqueue), [source, enqueue]);

  useEffect(() => {
    if (!current) return;
    // With more events waiting, shorten each greeting so the queue drains.
    const d = queue.current.length > 0 ? Math.max(3000, durationMs / 2) : durationMs;
    const t1 = setTimeout(() => setLeaving(true), d - EXIT_ANIM_MS);
    const t2 = setTimeout(advance, d);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [current, durationMs, advance]);

  const resetToIdle = useCallback(() => {
    queue.current = [];
    setQueueLength(0);
    currentRef.current = null;
    setCurrent(null);
    setLeaving(false);
  }, []);

  return { state: { current, leaving, queueLength, suppressed } as DisplayState, resetToIdle };
}
