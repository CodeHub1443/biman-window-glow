import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { addPoint, clampPoint, deletePoint, insertPoint, midpoint, movePoint } from "@/lib/settings-logic";
import { cn } from "@/lib/utils";
import type { Point, RoiConfig, RoiZone } from "@/types/settings";

const W = 1600;
const H = 900;
const toPx = (p: Point) => ({ x: p.x * W, y: p.y * H });
const pts = (z: RoiZone) => z.points.map((p) => `${p.x * W},${p.y * H}`).join(" ");

export type EditorMode = "select" | "draw";

type Drag = { kind: "point"; zoneId: string; index: number } | { kind: "line"; end: "a" | "b" } | null;

export function StillBackdrop({ still, src }: { still: RoiConfig["stillImage"]; src: string }) {
  return still === "lobby" ? (
    <img src={src} alt="Placeholder still image (not a camera frame)" className="absolute inset-0 h-full w-full select-none object-cover" draggable={false} />
  ) : (
    <div aria-hidden className="absolute inset-0 bg-muted [background-image:linear-gradient(var(--border)_1px,transparent_1px),linear-gradient(90deg,var(--border)_1px,transparent_1px)] [background-size:6.25%_11.11%]" />
  );
}

/**
 * Interactive polygon / virtual-line editor over a still placeholder image. Coordinates are
 * normalised (0..1) so the same ROI model works for any real camera resolution later.
 */
export function RoiEditor({
  value, saved, onChange, mode, setMode, selectedZoneId, setSelectedZoneId, stillSrc, invalidZoneIds, dirty,
}: {
  value: RoiConfig; saved: RoiConfig; onChange: (v: RoiConfig) => void; mode: EditorMode; setMode: (m: EditorMode) => void;
  selectedZoneId: string | null; setSelectedZoneId: (id: string | null) => void; stillSrc: string; invalidZoneIds: Set<string>; dirty: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Drag>(null);
  const [selPoint, setSelPoint] = useState<number | null>(null);
  const zone = value.zones.find((z) => z.id === selectedZoneId) ?? null;

  const toNorm = (e: { clientX: number; clientY: number }): Point => {
    const r = svgRef.current!.getBoundingClientRect();
    return clampPoint({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
  };
  const setZone = (z: RoiZone) => onChange({ ...value, zones: value.zones.map((x) => (x.id === z.id ? z : x)) });

  const onBackground = (e: PointerEvent<SVGElement>) => {
    if (mode !== "draw" || !zone) {
      setSelPoint(null);
      return;
    }
    const p = toNorm(e);
    const first = zone.points[0];
    const r = svgRef.current!.getBoundingClientRect();
    if (first && zone.points.length >= 3 && Math.hypot((p.x - first.x) * r.width, (p.y - first.y) * r.height) < 14) {
      setMode("select"); // clicking the first point closes the shape
      return;
    }
    setZone(addPoint(zone, p));
    setSelPoint(zone.points.length);
  };

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const p = toNorm(e);
    if (drag.kind === "point") {
      const z = value.zones.find((x) => x.id === drag.zoneId);
      if (z) setZone(movePoint(z, drag.index, p));
    } else onChange({ ...value, line: { ...value.line, [drag.end]: p } });
  };

  const onVertexKey = (z: RoiZone, i: number) => (e: KeyboardEvent<SVGCircleElement>) => {
    const step = e.shiftKey ? 0.05 : 0.01;
    const p = z.points[i]!;
    const moves: Record<string, Point> = {
      ArrowLeft: { x: p.x - step, y: p.y }, ArrowRight: { x: p.x + step, y: p.y }, ArrowUp: { x: p.x, y: p.y - step }, ArrowDown: { x: p.x, y: p.y + step },
    };
    if (moves[e.key]) {
      e.preventDefault();
      setZone(movePoint(z, i, moves[e.key]!));
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      setZone(deletePoint(z, i));
      setSelPoint(null);
    }
  };

  const onLineKey = (end: "a" | "b") => (e: KeyboardEvent<SVGCircleElement>) => {
    const step = e.shiftKey ? 0.05 : 0.01;
    const p = value.line[end];
    const moves: Record<string, Point> = {
      ArrowLeft: { x: p.x - step, y: p.y }, ArrowRight: { x: p.x + step, y: p.y }, ArrowUp: { x: p.x, y: p.y - step }, ArrowDown: { x: p.x, y: p.y + step },
    };
    if (moves[e.key]) {
      e.preventDefault();
      onChange({ ...value, line: { ...value.line, [end]: clampPoint(moves[e.key]!) } });
    }
  };

  const line = value.line;
  const a = toPx(line.a);
  const b = toPx(line.b);
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const nx = -(b.y - a.y) / len; // normal pointing to the right of A→B (screen coords)
  const ny = (b.x - a.x) / len;
  const arrow = (dir: 1 | -1) => {
    const tip = { x: mid.x + nx * 70 * dir, y: mid.y + ny * 70 * dir };
    const base = { x: mid.x - nx * 10 * dir, y: mid.y - ny * 10 * dir };
    return (
      <g key={dir} className="text-gold" stroke="currentColor" fill="currentColor">
        <line x1={base.x} y1={base.y} x2={tip.x} y2={tip.y} strokeWidth={5} />
        <polygon points={`${tip.x},${tip.y} ${tip.x - nx * 22 * dir + ny * 14},${tip.y - ny * 22 * dir - nx * 14} ${tip.x - nx * 22 * dir - ny * 14},${tip.y - ny * 22 * dir + nx * 14}`} />
      </g>
    );
  };

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-md border border-border bg-muted">
      <StillBackdrop still={value.stillImage} src={stillSrc} />
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className={cn("absolute inset-0 h-full w-full touch-none", mode === "draw" ? "cursor-crosshair" : "cursor-default")}
        onPointerMove={onMove}
        onPointerUp={() => setDrag(null)}
        onPointerLeave={() => setDrag(null)}
        role="application"
        aria-label={`ROI editor for ${value.cameraId}. ${mode === "draw" ? "Draw mode: click to add points, click the first point to finish." : "Select mode: drag points to move them."}`}
      >
        <rect x={0} y={0} width={W} height={H} fill="transparent" onPointerDown={onBackground} />

        {/* Saved shapes as dashed ghosts when there are unsaved edits */}
        {dirty && saved.zones.map((z) => z.points.length >= 2 && (
          <polygon key={`saved-${z.id}`} points={pts(z)} fill="none" className="text-muted-foreground" stroke="currentColor" strokeWidth={3} strokeDasharray="10 8" pointerEvents="none" />
        ))}

        {value.zones.map((z) => {
          const selected = z.id === selectedZoneId;
          const invalid = invalidZoneIds.has(z.id);
          const tone = z.kind === "entry" ? "text-entry" : "text-exit";
          const closed = !(selected && mode === "draw");
          return (
            <g key={z.id} className={invalid ? "text-destructive" : tone}>
              {z.points.length >= 2 && (closed
                ? <polygon points={pts(z)} fill="currentColor" fillOpacity={selected ? 0.28 : 0.16} stroke="currentColor" strokeWidth={selected ? 5 : 3}
                    onPointerDown={(e) => { if (mode === "select") { e.stopPropagation(); setSelectedZoneId(z.id); setSelPoint(null); } else onBackground(e); }} className="cursor-pointer" />
                : <polyline points={pts(z)} fill="none" stroke="currentColor" strokeWidth={5} pointerEvents="none" />)}
              {z.points[0] && (
                <text x={toPx(z.points[0]).x + 14} y={toPx(z.points[0]).y - 14} fill="currentColor" fontSize={30} fontFamily="var(--font-mono)" pointerEvents="none" className="font-semibold">
                  {z.label || "Zone"}
                </text>
              )}
              {selected && mode === "select" && z.points.length >= 2 && z.points.map((p, i) => {
                const q = z.points[(i + 1) % z.points.length]!;
                if (z.points.length < 3 && i === z.points.length - 1) return null;
                const m = toPx(midpoint(p, q));
                return (
                  <circle key={`m${i}`} cx={m.x} cy={m.y} r={9} className="cursor-copy fill-background" stroke="currentColor" strokeWidth={3} strokeDasharray="3 3"
                    onPointerDown={(e) => { e.stopPropagation(); setZone(insertPoint(z, i + 1, midpoint(p, q))); setSelPoint(i + 1); setDrag({ kind: "point", zoneId: z.id, index: i + 1 }); }}>
                    <title>Insert point</title>
                  </circle>
                );
              })}
              {selected && z.points.map((p, i) => {
                const c = toPx(p);
                return (
                  <circle
                    key={i}
                    cx={c.x}
                    cy={c.y}
                    r={selPoint === i ? 16 : 12}
                    tabIndex={0}
                    role="button"
                    aria-label={`${z.label} point ${i + 1} of ${z.points.length} at ${Math.round(p.x * 100)}%, ${Math.round(p.y * 100)}%. Arrow keys move, Delete removes.`}
                    className={cn("cursor-grab outline-none focus-visible:stroke-[6px]", selPoint === i ? "fill-primary" : "fill-background")}
                    stroke="currentColor"
                    strokeWidth={4}
                    onFocus={() => setSelPoint(i)}
                    onKeyDown={onVertexKey(z, i)}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      if (mode === "draw" && i === 0 && z.points.length >= 3) { setMode("select"); return; }
                      (e.target as Element).setPointerCapture?.(e.pointerId);
                      setSelPoint(i);
                      setDrag({ kind: "point", zoneId: z.id, index: i });
                    }}
                  />
                );
              })}
            </g>
          );
        })}

        {line.enabled && (
          <g>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="text-gold" stroke="currentColor" strokeWidth={6} strokeDasharray="22 12" pointerEvents="none" />
            {(line.direction === "left_to_right" || line.direction === "both") && arrow(1)}
            {(line.direction === "right_to_left" || line.direction === "both") && arrow(-1)}
            {(["a", "b"] as const).map((end) => {
              const c = end === "a" ? a : b;
              return (
                <g key={end}>
                  <circle cx={c.x} cy={c.y} r={15} tabIndex={0} role="button" aria-label={`Virtual line end ${end.toUpperCase()}. Arrow keys move.`}
                    className="cursor-grab fill-gold outline-none focus-visible:stroke-foreground" stroke="currentColor" strokeWidth={3}
                    onKeyDown={onLineKey(end)}
                    onPointerDown={(e) => { e.stopPropagation(); (e.target as Element).setPointerCapture?.(e.pointerId); setDrag({ kind: "line", end }); }} />
                  <text x={c.x + 20} y={c.y + 10} fontSize={30} fontFamily="var(--font-mono)" className="fill-gold font-bold" pointerEvents="none">{end.toUpperCase()}</text>
                </g>
              );
            })}
          </g>
        )}
      </svg>
      <div className="pointer-events-none absolute left-2 top-2 rounded-sm bg-background/80 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-foreground">
        Still placeholder · not live
      </div>
      {mode === "draw" && (
        <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-sm bg-background/85 px-2 py-1 font-mono text-[11px] text-foreground">
          Click to add points · click the first point (or Finish) to close
        </div>
      )}
    </div>
  );
}
