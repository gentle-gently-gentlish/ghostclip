export type SeriesId =
  | "desk-chain"
  | "marble-run"
  | "kitchen-table"
  | "soft-domino"
  | "loop-machine";

export type Series = {
  id: SeriesId;
  name: string;
  blurb: string;
  payoff: string;
  shotHint: string;
};

/** Gentle Gentlemen — looping Rube Goldberg style animations */
export const CHANNEL = {
  niche: "Looping Rube Goldberg Animations",
  promise:
    "Soft chain-reaction machines that reset themselves — calm, clever, built to loop.",
  rules: [
    "No face — machine and objects only",
    "Must loop: last beat feeds the first",
    "Gentle pacing — whimsical, not chaotic explosion energy",
    "Payoff is the elegant reset / the chain completing cleanly",
  ],
} as const;

export const SERIES: Series[] = [
  {
    id: "desk-chain",
    name: "Desk Chain",
    blurb: "Pencils, binders, clips — office objects in a quiet cascade.",
    payoff: "Last clip tips the first pencil again",
    shotHint: "Overhead or 3/4 desk view, soft daylight, 9:16",
  },
  {
    id: "marble-run",
    name: "Marble Run",
    blurb: "Tracks, funnels, soft drops — one marble that never stops.",
    payoff: "Marble returns to the start gate for a seamless loop",
    shotHint: "Follow marble gently; keep motion readable",
  },
  {
    id: "kitchen-table",
    name: "Kitchen Table",
    blurb: "Spoons, cups, sugar cubes — cozy domestic chain reactions.",
    payoff: "Teacup nudge restarts the spoon tip",
    shotHint: "Warm wood table, pastel props, calm lighting",
  },
  {
    id: "soft-domino",
    name: "Soft Domino",
    blurb: "Books, erasers, soft blocks — slow topples with kind physics.",
    payoff: "Final tip re-stands or re-triggers the first row",
    shotHint: "Side angle so the wave reads clearly",
  },
  {
    id: "loop-machine",
    name: "Loop Machine",
    blurb: "Purpose-built contraption whose end is its beginning.",
    payoff: "Invisible join — the machine never “finishes”",
    shotHint: "Wide enough to see the whole path, then soft push-ins",
  },
];

export function getSeries(id: string): Series | undefined {
  return SERIES.find((s) => s.id === id);
}
