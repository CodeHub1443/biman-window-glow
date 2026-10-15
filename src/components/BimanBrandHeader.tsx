/**
 * Official logo slot. Replace LOGO_SRC with the supplied Biman logo file
 * (e.g. import logo from "@/assets/biman-logo.png"). Until then a labelled placeholder shows.
 */
const LOGO_SRC: string | null = null;

export function BimanBrandHeader() {
  return (
    <div className="flex items-center gap-[1vw] hud-text">
      {LOGO_SRC ? (
        <img src={LOGO_SRC} alt="Biman Bangladesh Airlines" className="h-[6vh]" />
      ) : (
        <div
          className="flex h-[6vh] items-center justify-center rounded-md border border-dashed border-hud-dim px-[1vw] text-center font-mono text-[1.1vh] uppercase leading-tight tracking-widest hud-glass"
          aria-label="Biman logo placeholder"
        >
          Official logo
          <br />
          placeholder
        </div>
      )}
      <div className="leading-tight">
        <div className="font-display text-[2.2vh] font-semibold tracking-tight">Biman Bangladesh Airlines</div>
        <div className="font-mono text-[1.1vh] uppercase tracking-[0.3em] text-hud/70">The Airline of Bangladesh</div>
      </div>
    </div>
  );
}
