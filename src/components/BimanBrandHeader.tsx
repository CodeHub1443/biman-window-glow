/**
 * Official logo slot. Replace LOGO_SRC with the supplied Biman logo file
 * (e.g. import logo from "@/assets/biman-logo.png"). Until then a labelled placeholder shows.
 */
const LOGO_SRC: string | null = null;

export function BimanBrandHeader({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      {LOGO_SRC ? (
        <img src={LOGO_SRC} alt="Biman Bangladesh Airlines" className={compact ? "h-10" : "h-14"} />
      ) : (
        <div
          className={`flex items-center justify-center rounded-md border border-dashed border-primary/60 bg-primary/10 font-mono uppercase tracking-widest text-primary ${compact ? "h-10 px-3 text-[9px]" : "h-14 px-4 text-[10px]"}`}
          aria-label="Biman logo placeholder"
        >
          Official logo
          <br />
          placeholder
        </div>
      )}
      {!compact && (
        <div className="leading-tight">
          <div className="font-display text-lg font-semibold tracking-tight text-foreground">
            Biman Bangladesh Airlines
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Visitor Greeting System
          </div>
        </div>
      )}
    </div>
  );
}
