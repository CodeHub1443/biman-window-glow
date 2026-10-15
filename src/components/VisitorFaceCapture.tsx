import { useState } from "react";
import { UserRound } from "lucide-react";

export function VisitorFaceCapture({ src, isDemo, accent }: { src?: string; isDemo?: boolean; accent: "entry" | "exit" }) {
  const [broken, setBroken] = useState(false);
  const ring = accent === "entry" ? "border-entry" : "border-exit";
  return (
    <div className={`relative aspect-square w-full overflow-hidden rounded-sm border-2 ${ring} bg-hud-ink/60`}>
      {src && !broken ? (
        <img src={src} alt="Captured visitor face" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 hud-text">
          <UserRound className="h-1/3 w-1/3 opacity-60" />
          <span className="font-mono text-[10px] uppercase tracking-[0.25em]">Image unavailable</span>
        </div>
      )}
      {/* corner brackets */}
      {["left-1 top-1 border-l-2 border-t-2", "right-1 top-1 border-r-2 border-t-2", "left-1 bottom-1 border-l-2 border-b-2", "right-1 bottom-1 border-r-2 border-b-2"].map((c) => (
        <span key={c} className={`absolute h-5 w-5 border-hud ${c}`} />
      ))}
      <div className="pointer-events-none absolute inset-x-0 h-1/3 bg-gradient-to-b from-transparent via-hud/20 to-transparent animate-sweep" />
      {isDemo && (
        <span className="absolute left-2 top-2 rounded-sm bg-gold px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-hud-ink">
          Demo sample
        </span>
      )}
    </div>
  );
}
