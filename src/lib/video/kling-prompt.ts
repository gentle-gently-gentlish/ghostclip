import type { Clip } from "@/lib/clips";

/** Build a Kling text-to-video prompt optimized for looping Rube Goldberg Shorts */
export function buildKlingPrompt(clip: Clip, channelName: string): string {
  const chain = clip.beats
    .map((b) => b.direction)
    .filter(Boolean)
    .slice(0, 4)
    .join(" Then ");

  return [
    `Vertical 9:16 seamless looping Rube Goldberg chain-reaction animation for faceless YouTube Shorts.`,
    `Channel vibe: Gentle Gentlemen — soft, calm, whimsical, quiet dopamine.`,
    `Series: ${clip.seriesName}.`,
    `Concept: ${clip.hook}.`,
    chain ? `Action path: ${chain}` : "",
    `Look: soft pastel props, matte materials, gentle physics, warm desk/table lighting, no people, no faces, no text overlays, no logos.`,
    `Camera: locked or very slow push-in, readable cause-and-effect, one hero motion at a time.`,
    `Critical: the ending must visually restart the beginning so the clip loops forever.`,
    `Style: photoreal miniature / stop-motion-smooth CGI hybrid, high detail, satisfying, relaxing.`,
    `Brand watermark not needed — leave clean frame for ${channelName}.`,
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 2400);
}

export const KLING_NEGATIVE =
  "face, person, hands close-up selfie, text, captions, watermark, logo, explosion, fire, blood, glitch, shaky cam, fast cut montage, low quality, blurry, distorted, cartoonish spammy colors";
