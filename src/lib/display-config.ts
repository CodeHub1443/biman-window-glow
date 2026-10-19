/**
 * Visitor Display configuration.
 * To use your own idle video: put the file in /public/videos/ and update IDLE_VIDEO below
 * (e.g. { mp4: "/videos/idle.mp4", webm: "/videos/idle.webm" }).
 */
import fallbackImage from "@/assets/window-sky-wide.jpg";

export const displayConfig = {
  idleVideo: {
    // No idle video supplied yet: undefined shows the designed fallback image with no failed request.
    mp4: undefined as string | undefined, // e.g. "/videos/idle.mp4"
    webm: undefined as string | undefined,
    fallbackImage,
    fit: "cover" as "cover" | "contain",
  },
  greetingDurationMs: 7000,
  station: { code: "DAC", name: "Biman HQ · Main Entrance" },
  entry: { headline: "WELCOME ABOARD", sub: "Welcome to Biman Bangladesh Airlines" },
  exit: { headline: "THANK YOU FOR VISITING", sub: "Have a pleasant journey. We hope to see you again soon." },
};
