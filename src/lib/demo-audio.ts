/** Browser-only demo tone player for audio previews. Never touches station speakers. */
export async function playDemoTone(tones: number[], volume: number): Promise<void> {
  const Ctor = typeof window !== "undefined" ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
  if (!Ctor) throw new Error("This browser cannot play audio previews.");
  if (!tones.length) return;
  const ctx = new Ctor();
  const gain = ctx.createGain();
  gain.gain.value = Math.max(0, Math.min(1, volume / 100)) * 0.25;
  gain.connect(ctx.destination);
  const step = 0.22;
  tones.forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = f;
    o.connect(gain);
    o.start(ctx.currentTime + i * step);
    o.stop(ctx.currentTime + i * step + step * 0.9);
  });
  await new Promise((r) => setTimeout(r, tones.length * step * 1000 + 100));
  await ctx.close();
}
