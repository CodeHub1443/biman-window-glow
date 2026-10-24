import { useState } from "react";

export interface IdleWindowVideoProps {
  mp4?: string | undefined;
  webm?: string | undefined;
  fallbackImage: string;
  fit?: "cover" | "contain";
  motion?: "full" | "reduced";
}

/** Looping, muted, inline idle video. Falls back to a still image when the source is missing. */
export function IdleWindowVideo({ mp4, webm, fallbackImage, fit = "cover", motion = "full" }: IdleWindowVideoProps) {
  // Failure is remembered per source pair, so a newly configured video gets a fresh attempt.
  const srcKey = `${mp4 ?? ""}|${webm ?? ""}`;
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const failed = (!mp4 && !webm) || failedKey === srcKey;
  const fail = () => setFailedKey(srcKey);
  const fitCls = fit === "cover" ? "object-cover" : "object-contain";

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Fallback always sits underneath so there is never a black frame */}
      <img src={fallbackImage} alt="" className={`absolute inset-0 h-full w-full ${fitCls} ${motion === "full" ? "animate-drift" : ""}`} />
      {!failed && (
        <video
          key={srcKey}
          className={`absolute inset-0 h-full w-full ${fitCls}`}
          autoPlay
          muted
          loop
          playsInline
          disablePictureInPicture
          controls={false}
          onError={fail}
        >
          {webm && <source src={webm} type="video/webm" onError={() => !mp4 && fail()} />}
          {mp4 && <source src={mp4} type="video/mp4" onError={fail} />}
        </video>
      )}
      {failed && (
        <div className="absolute top-[15vh] left-1/2 -translate-x-1/2 rounded-sm border border-dashed border-hud-dim px-3 py-1 font-mono text-[10px] uppercase tracking-[0.25em] hud-text">
          Idle video placeholder
        </div>
      )}
    </div>
  );
}
