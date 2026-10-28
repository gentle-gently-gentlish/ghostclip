import type { SeriesId } from "@/lib/niches";

export type SceneId = SeriesId;

/** 9:16 master size for Shorts/Reels (balanced for server render speed) */
export const VIDEO = {
  width: 720,
  height: 1280,
  fps: 24,
  durationSec: 5,
} as const;

/** Minimal canvas API used by both browser and node-canvas */
export type DrawContext = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fillStyle: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  strokeStyle: any;
  lineWidth: number;
  lineCap: CanvasLineCap;
  globalAlpha: number;
  font: string;
  textAlign: CanvasTextAlign;
  fillRect: (x: number, y: number, w: number, h: number) => void;
  beginPath: () => void;
  closePath: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  arc: (
    x: number,
    y: number,
    r: number,
    a0: number,
    a1: number,
    ccw?: boolean,
  ) => void;
  arcTo: (x1: number, y1: number, x2: number, y2: number, r: number) => void;
  bezierCurveTo: (
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number,
  ) => void;
  fill: () => void;
  stroke: () => void;
  fillText: (text: string, x: number, y: number) => void;
  save: () => void;
  restore: () => void;
  translate: (x: number, y: number) => void;
  rotate: (a: number) => void;
  createLinearGradient: (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ) => CanvasGradient;
};

export type Vec = { x: number; y: number };

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** Looping time 0..1 across the full clip */
export function loopT(frame: number, totalFrames: number) {
  return (frame % totalFrames) / totalFrames;
}

const COLORS = {
  bgTop: "#1c1814",
  bgBot: "#0e0c0a",
  mist: "#f3eee6",
  signal: "#c4f082",
  wood: "#5c4636",
  clay: "#8b7355",
  accent: "#e8c4a0",
  ink: "#14110f",
};

function bg(ctx: DrawContext, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, COLORS.bgTop);
  g.addColorStop(1, COLORS.bgBot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // soft vignette dots
  ctx.fillStyle = "rgba(243,238,230,0.03)";
  for (let i = 0; i < 18; i++) {
    const x = ((i * 97) % w) + 40;
    const y = ((i * 163) % h) + 60;
    ctx.beginPath();
    ctx.arc(x, y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function roundRect(
  ctx: DrawContext,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function watermark(
  ctx: DrawContext,
  w: number,
  h: number,
  name: string,
  t: number,
) {
  const alpha = t > 0.85 ? easeInOut((t - 0.85) / 0.15) * 0.85 : 0;
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = COLORS.signal;
  ctx.font = "600 36px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(name, w / 2, h - 120);
  ctx.restore();
}

function drawDeskChain(
  ctx: DrawContext,
  w: number,
  h: number,
  t: number,
  channel: string,
) {
  bg(ctx, w, h);
  // desk surface
  ctx.fillStyle = COLORS.wood;
  roundRect(ctx, 80, h * 0.55, w - 160, h * 0.28, 24);
  ctx.fill();

  const pens = 6;
  for (let i = 0; i < pens; i++) {
    const fallStart = i / pens;
    const local = clamp((t - fallStart) / 0.18, 0, 1);
    const angle = lerp(0, Math.PI / 2.2, easeInOut(local));
    const x = 180 + i * 120;
    const y = h * 0.62;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = i % 2 === 0 ? COLORS.signal : COLORS.accent;
    roundRect(ctx, 0, -10, 110, 20, 8);
    ctx.fill();
    ctx.restore();
  }

  // binder clip that "snaps" near the end then resets via loop
  const snap = easeInOut(clamp((t - 0.72) / 0.2, 0, 1));
  ctx.fillStyle = COLORS.mist;
  roundRect(ctx, w * 0.72, h * 0.58 + snap * 40, 70, 50, 8);
  ctx.fill();

  watermark(ctx, w, h, channel, t);
}

function drawMarbleRun(
  ctx: DrawContext,
  w: number,
  h: number,
  t: number,
  channel: string,
) {
  bg(ctx, w, h);

  // tracks
  ctx.strokeStyle = COLORS.clay;
  ctx.lineWidth = 18;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(160, 280);
  ctx.bezierCurveTo(400, 280, 200, 700, 500, 700);
  ctx.bezierCurveTo(850, 700, 700, 1100, 900, 1100);
  ctx.bezierCurveTo(1040, 1100, 900, 1500, 540, 1580);
  ctx.stroke();

  // lift tube (visual)
  ctx.strokeStyle = COLORS.signal;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(540, 1580);
  ctx.lineTo(160, 280);
  ctx.stroke();

  // marble position along path (piecewise)
  const path: Vec[] = [
    { x: 160, y: 280 },
    { x: 320, y: 420 },
    { x: 500, y: 700 },
    { x: 780, y: 880 },
    { x: 900, y: 1100 },
    { x: 820, y: 1350 },
    { x: 540, y: 1580 },
    { x: 160, y: 280 }, // return via lift for loop
  ];
  const seg = t * (path.length - 1);
  const i = Math.floor(seg);
  const f = seg - i;
  const a = path[Math.min(i, path.length - 2)];
  const b = path[Math.min(i + 1, path.length - 1)];
  const x = lerp(a.x, b.x, easeInOut(f));
  const y = lerp(a.y, b.y, easeInOut(f));

  ctx.fillStyle = COLORS.mist;
  ctx.beginPath();
  ctx.arc(x, y, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.signal;
  ctx.beginPath();
  ctx.arc(x - 6, y - 6, 8, 0, Math.PI * 2);
  ctx.fill();

  watermark(ctx, w, h, channel, t);
}

function drawKitchen(
  ctx: DrawContext,
  w: number,
  h: number,
  t: number,
  channel: string,
) {
  bg(ctx, w, h);
  ctx.fillStyle = COLORS.wood;
  roundRect(ctx, 60, h * 0.5, w - 120, h * 0.32, 20);
  ctx.fill();

  // sugar cube tip
  const tip = easeInOut(clamp(t / 0.25, 0, 1));
  ctx.save();
  ctx.translate(220, h * 0.58);
  ctx.rotate(lerp(0, 0.9, tip));
  ctx.fillStyle = COLORS.mist;
  ctx.fillRect(-24, -24, 48, 48);
  ctx.restore();

  // spoon catapult
  const spoon = easeInOut(clamp((t - 0.2) / 0.3, 0, 1));
  ctx.save();
  ctx.translate(420, h * 0.62);
  ctx.rotate(lerp(0.2, -0.8, spoon));
  ctx.fillStyle = COLORS.clay;
  roundRect(ctx, 0, -12, 160, 24, 12);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(170, 0, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // teabag swing
  const bag = easeInOut(clamp((t - 0.45) / 0.35, 0, 1));
  const bx = lerp(700, 240, bag);
  const by = h * 0.56 + Math.sin(bag * Math.PI) * 80;
  ctx.strokeStyle = COLORS.mist;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(700, h * 0.52);
  ctx.lineTo(bx, by);
  ctx.stroke();
  ctx.fillStyle = COLORS.signal;
  roundRect(ctx, bx - 20, by, 40, 50, 6);
  ctx.fill();

  watermark(ctx, w, h, channel, t);
}

function drawDomino(
  ctx: DrawContext,
  w: number,
  h: number,
  t: number,
  channel: string,
) {
  bg(ctx, w, h);
  const n = 9;
  for (let i = 0; i < n; i++) {
    const start = i * 0.08;
    const local = clamp((t - start) / 0.15, 0, 1);
    // last one "rebuilds" first via loop feel: near end, first rises
    let angle = lerp(0, 1.2, easeInOut(local));
    if (i === 0 && t > 0.88) {
      angle = lerp(1.2, 0, easeInOut((t - 0.88) / 0.12));
    }
    const x = 140 + i * 90;
    const y = h * 0.65;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = i % 2 ? COLORS.accent : COLORS.mist;
    roundRect(ctx, -18, -100, 36, 120, 6);
    ctx.fill();
    ctx.restore();
  }
  watermark(ctx, w, h, channel, t);
}

function drawLoopMachine(
  ctx: DrawContext,
  w: number,
  h: number,
  t: number,
  channel: string,
) {
  bg(ctx, w, h);
  const cx = w / 2;
  const cy = h * 0.48;
  const r = 280;

  // ring
  ctx.strokeStyle = COLORS.clay;
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // gears
  for (let g = 0; g < 3; g++) {
    const ang = t * Math.PI * 2 + (g * Math.PI * 2) / 3;
    const gx = cx + Math.cos(ang) * r;
    const gy = cy + Math.sin(ang) * r;
    ctx.fillStyle = g === 0 ? COLORS.signal : COLORS.accent;
    ctx.beginPath();
    ctx.arc(gx, gy, 42, 0, Math.PI * 2);
    ctx.fill();
  }

  // ball on ring
  const a = t * Math.PI * 2 - Math.PI / 2;
  ctx.fillStyle = COLORS.mist;
  ctx.beginPath();
  ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 34, 0, Math.PI * 2);
  ctx.fill();

  watermark(ctx, w, h, channel, t);
}

export function paintFrame(
  ctx: DrawContext,
  seriesId: SceneId,
  frame: number,
  totalFrames: number,
  channelName: string,
) {
  const t = loopT(frame, totalFrames);
  const { width: w, height: h } = VIDEO;
  switch (seriesId) {
    case "desk-chain":
      drawDeskChain(ctx, w, h, t, channelName);
      break;
    case "marble-run":
      drawMarbleRun(ctx, w, h, t, channelName);
      break;
    case "kitchen-table":
      drawKitchen(ctx, w, h, t, channelName);
      break;
    case "soft-domino":
      drawDomino(ctx, w, h, t, channelName);
      break;
    case "loop-machine":
    default:
      drawLoopMachine(ctx, w, h, t, channelName);
      break;
  }
}
