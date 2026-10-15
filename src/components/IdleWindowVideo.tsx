import { useState } from "react";

export interface IdleWindowVideoProps {
  mp4?: string;
  webm?: string;
  fallbackImage: string;
  fit?: "cover" | "contain";
}

/** Looping, muted, inline idle video. Falls back to a still image when the source is missing. */
export function IdleWindowVideo({ mp4, webm, fallbackImage, fit = "cover" }: IdleWindowVideoProps) {
  const [failed, setFailed] = useState(!mp4 && !webm);
  const fitCls = fit === "cover" ? "object-cover" : "object-contain";

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Fallback always sits underneath so there is never a black frame */}
      <img src={fallbackImage} alt="" className={`absolute inset-0 h-full w-full ${fitCls} animate-drift`} />
      {!failed && (
        <video
          key={`${mp4}|${webm}`}
          className={`absolute inset-0 h-full w-full ${fitCls}`}
          autoPlay
          muted
          loop
          playsInline
          disablePictureInPicture
          controls={false}
          onError={() => setFailed(true)}
        >
          {webm && <source src={webm} type="video/webm" onError={() => !mp4 && setFailed(true)} />}
          {mp4 && <source src={mp4} type="video/mp4" onError={() => setFailed(true)} />}
        </video>
      )}
      {failed && (
        <div className="absolute bottom-[14%] left-1/2 -translate-x-1/2 rounded-sm border border-dashed border-hud-dim px-3 py-1 font-mono text-[10px] uppercase tracking-[0.25em] hud-text">
          Idle video placeholder
        </div>
      )}
    </div>
  );
}
