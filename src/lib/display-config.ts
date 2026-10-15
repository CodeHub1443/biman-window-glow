/**
 * Visitor Display configuration.
 * To use your own idle video: put the file in /public/videos/ and update IDLE_VIDEO below
 * (e.g. { mp4: "/videos/idle.mp4", webm: "/videos/idle.webm" }).
 */
import fallbackImage from "@/assets/window-sky.jpg";

export const displayConfig = {
  idleVideo: {
    mp4: "/videos/idle.mp4" as string | undefined,
    webm: undefined as string | undefined,
    fallbackImage,
    fit: "cover" as "cover" | "contain",
  },
  greetingDurationMs: 7000,
  station: { code: "DAC", name: "Biman HQ · Station 1" },
  entry: { headline: "WELCOME ABOARD", sub: "Welcome to Biman Bangladesh Airlines" },
  exit: { headline: "THANK YOU FOR VISITING", sub: "Have a pleasant journey. We hope to see you again soon." },
};
