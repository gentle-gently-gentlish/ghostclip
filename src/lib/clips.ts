import { CHANNEL, getSeries, SERIES, type SeriesId } from "./niches";

export type ClipInput = {
  channelName: string;
  seriesIds?: SeriesId[];
  count?: number;
  notes?: string;
};

export type PlatformPack = {
  title: string;
  caption: string;
  hashtags: string[];
  description?: string;
};

export type ClipBeat = {
  atSec: number;
  onScreen: string;
  direction: string;
};

export type Clip = {
  id: string;
  seriesId: SeriesId;
  seriesName: string;
  hook: string;
  durationSec: number;
  beats: ClipBeat[];
  broll: string[];
  sfx: string[];
  loopNotes: string;
  thumbnailText: string;
  youtube: PlatformPack;
  instagram: PlatformPack;
};

export type ClipBatch = {
  mode: "live" | "local";
  channelName: string;
  niche: string;
  postingPlan: string[];
  clips: Clip[];
};

function slug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 42);
}

const IDEA_BANK: Record<SeriesId, string[]> = {
  "desk-chain": [
    "Pencil rolls → binder clip snaps → sticky note flips → pencil again",
    "Eraser nudges ruler → ruler tips mug → string pulls first eraser",
    "Paperclip slide → notebook closes → breeze returns the clip",
    "Tape dispenser roll → card falls → lever resets the tape",
    "Quiet stapler arm → domino pens → soft return to stapler",
  ],
  "marble-run": [
    "Marble down spiral → funnel → lift wheel returns marble to top",
    "Two-track weave; marble A starts marble B’s lift forever",
    "Soft wood run with three drops; last cup tips the gate open",
    "Glass marble on brass rails, waterwheel reset",
    "Pastel tube run that empties into its own start funnel",
  ],
  "kitchen-table": [
    "Sugar cube tip → spoon catapult → tea bag tug → sugar again",
    "Rolling lime → salt shaker rock → napkin slide → lime restart",
    "Honey dipper drip triggers tiny scale → spoon tips dipper",
    "Cup saucer cascade ending in the first cup’s nudge",
    "Butter knife soft tap → toast lean → jam jar lid spin → knife",
  ],
  "soft-domino": [
    "Hardcover books slow-wave into a soft block that restands row one",
    "Eraser dominoes into a spinning lazy-Susan reset",
    "Felt blocks topple into a gentle scoop that rebuilds the line",
    "Postcard lean chain; last card fans the first upright",
    "Candle stubs (unlit) soft knock into a looped tray return",
  ],
  "loop-machine": [
    "Ball lift → ramp → gear → string → ball lift (closed system)",
    "Sand timer empties into a scoop that flips the timer forever",
    "Balloon (already inflated) slow leak turns a mill that re-fans it visually in loop edit",
    "Water pour wheel that recirculates in a clear loop tank",
    "Crank-free perpetual-looking desk gadget — end frame = start",
  ],
};

function hashtagsFor(series: string): { yt: string[]; ig: string[] } {
  const base = [
    "rubegoldberg",
    "chainreaction",
    "oddlysatisfying",
    "satisfying",
    "loop",
    "animation",
    "relaxing",
    "gentlegentlemen",
  ];
  const seriesTag = series.replace(/[^a-zA-Z0-9]+/g, "").toLowerCase();
  return {
    yt: ["Shorts", ...base, seriesTag],
    ig: ["reels", "instareels", ...base, seriesTag, "satisfyingvideo"],
  };
}

function buildClip(
  index: number,
  seriesId: SeriesId,
  idea: string,
  channelName: string,
): Clip {
  const series = getSeries(seriesId)!;
  const tags = hashtagsFor(series.name);
  const hook = idea;
  const short =
    hook.length > 72 ? `${hook.slice(0, 69).trim()}…` : hook;

  const beats: ClipBeat[] = [
    {
      atSec: 0,
      onScreen: "",
      direction: `Open on the first trigger object already mid-setup. Idea: ${short}. Frame 0 = loop start.`,
    },
    {
      atSec: 2,
      onScreen: "",
      direction: `Trigger the chain: ${series.blurb} Calm physics; readable cause → effect; no face.`,
    },
    {
      atSec: 8,
      onScreen: "",
      direction: `Mid-chain spectacle — ${series.shotHint}. Keep one clear hero motion at a time.`,
    },
    {
      atSec: 16,
      onScreen: "",
      direction: `Steer toward payoff: ${series.payoff}`,
    },
    {
      atSec: 24,
      onScreen: channelName,
      direction: `Final action must re-arm or visually match the opening trigger for a seamless loop. Soft watermark: ${channelName}`,
    },
  ];

  return {
    id: `clip-${index + 1}-${slug(idea)}`,
    seriesId,
    seriesName: series.name,
    hook: short,
    durationSec: 28,
    beats,
    broll: [
      series.shotHint,
      "Soft Gentle Gentlemen palette — mist, clay, muted pastels",
      "Props: everyday objects, nothing violent or messy-food-chaos",
      "Show enough of the path that the chain is easy to follow",
    ],
    sfx: [
      "Soft taps, wood knocks, marble rolls — gentle, synced to hits",
      "Optional near-silent warm bed under −24dB",
      "No voiceover; no big cartoon boings",
    ],
    loopNotes:
      "Last event must restart the first. Match first/last frame or cut on the repeat trigger. Replay-test 3× before export.",
    thumbnailText:
      short.split(/[—→,-]/)[0]?.trim().slice(0, 28).toUpperCase() || "CHAIN LOOP",
    youtube: {
      title: short,
      caption: `${short}\n\nLooping Rube Goldberg energy — Gentle Gentlemen.\n\n#Shorts #rubegoldberg`,
      description: `${short}\n\nFaceless looping chain-reaction animation from ${channelName}.\nSeries: ${series.name}\n\nBuilt to replay. Soft physics. No face.\n\n#Shorts #rubegoldberg #chainreaction #oddlysatisfying #satisfying #loop`,
      hashtags: tags.yt,
    },
    instagram: {
      title: short,
      caption: `${short}\n\nSoft chain reaction. Watch it loop.\n— ${channelName}`,
      hashtags: tags.ig,
    },
  };
}

function pickIdeas(
  seriesIds: SeriesId[],
  count: number,
): { seriesId: SeriesId; idea: string }[] {
  const out: { seriesId: SeriesId; idea: string }[] = [];
  let i = 0;
  while (out.length < count) {
    const seriesId = seriesIds[out.length % seriesIds.length];
    const bank = IDEA_BANK[seriesId];
    const idea = bank[i % bank.length];
    const varied =
      i >= bank.length ? `${idea} (variation ${Math.floor(i / bank.length) + 1})` : idea;
    out.push({ seriesId, idea: varied });
    i++;
  }
  return out;
}

function localBatch(input: ClipInput): ClipBatch {
  const channelName = input.channelName.trim() || "Gentle Gentlemen";
  const count = Math.min(Math.max(input.count ?? 7, 1), 21);
  const seriesIds =
    input.seriesIds?.length
      ? input.seriesIds
      : (SERIES.map((s) => s.id) as SeriesId[]);

  const picks = pickIdeas(seriesIds, count);
  const clips = picks.map((p, idx) =>
    buildClip(idx, p.seriesId, p.idea, channelName),
  );

  if (input.notes?.trim()) {
    clips[0] = {
      ...clips[0],
      hook: `${clips[0].hook} · note: ${input.notes.trim().slice(0, 80)}`,
    };
  }

  return {
    mode: "local",
    channelName,
    niche: CHANNEL.niche,
    postingPlan: [
      "Generate chain-reaction loop prompts in Ghostcut",
      "Animate in Blender / AE / AI video — end must restart the beginning",
      "Export 9:16; verify seamless loop by replaying 3×",
      "Post 3/day to YouTube Shorts + same cut to Instagram Reels",
      "Double down on the series with highest replay / avg view %",
    ],
    clips,
  };
}

async function liveBatch(input: ClipInput): Promise<ClipBatch | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const channelName = input.channelName.trim() || "Gentle Gentlemen";
  const count = Math.min(Math.max(input.count ?? 7, 1), 21);
  const seriesIds =
    input.seriesIds?.length
      ? input.seriesIds
      : (SERIES.map((s) => s.id) as SeriesId[]);
  const seriesNames = seriesIds
    .map((id) => getSeries(id)?.name)
    .filter(Boolean)
    .join(", ");

  const system = `You are Ghostcut for Gentle Gentlemen (@gentle.gently.gentlish). Focus ONLY on looping Rube Goldberg / chain-reaction machine style animations — soft, clever, satisfying cascades for YouTube Shorts and Instagram Reels. NOT Rubik's cubes. No faces, no explosions, calm whimsical physics. Every clip must loop (end restarts start). Return strict JSON:
{
  "postingPlan": string[5],
  "clips": [{
    "seriesId": string (one of: ${seriesIds.join("|")}),
    "seriesName": string,
    "hook": string,
    "durationSec": number,
    "beats": [{"atSec": number, "onScreen": string, "direction": string}],
    "broll": string[],
    "sfx": string[],
    "loopNotes": string,
    "thumbnailText": string,
    "youtube": {"title": string, "caption": string, "description": string, "hashtags": string[]},
    "instagram": {"title": string, "caption": string, "hashtags": string[]}
  }]
}
Exactly ${count} clips. Duration 20-35s. Directions must work as animation prompts (Blender/AE/AI).`;

  const user = `Channel: ${channelName}
Niche: ${CHANNEL.niche} — ${CHANNEL.promise}
Series to rotate: ${seriesNames}
Notes: ${input.notes || "soft pastels, everyday objects, gentle physics"}
Rules: ${CHANNEL.rules.join("; ")}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    console.error("OpenAI error", await res.text());
    return null;
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) return null;

  const parsed = JSON.parse(raw) as {
    postingPlan?: string[];
    clips?: Array<Omit<Clip, "id"> & { seriesId: string }>;
  };

  if (!parsed.clips?.length) return null;

  return {
    mode: "live",
    channelName,
    niche: CHANNEL.niche,
    postingPlan: parsed.postingPlan?.slice(0, 5) || localBatch(input).postingPlan,
    clips: parsed.clips.slice(0, count).map((c, i) => {
      const sid = (seriesIds.includes(c.seriesId as SeriesId)
        ? c.seriesId
        : seriesIds[i % seriesIds.length]) as SeriesId;
      return {
        ...c,
        id: `clip-${i + 1}-${slug(c.hook || `chain-${i + 1}`)}`,
        seriesId: sid,
        seriesName: c.seriesName || getSeries(sid)?.name || "Chain Loop",
        durationSec: c.durationSec || 28,
        beats: c.beats || [],
        broll: c.broll || [],
        sfx: c.sfx || [],
        loopNotes:
          c.loopNotes ||
          "End must restart the beginning; test on repeat before upload.",
        thumbnailText: c.thumbnailText || c.hook,
        youtube: c.youtube,
        instagram: c.instagram,
        hook: c.hook,
      };
    }),
  };
}

export async function generateClipBatch(input: ClipInput): Promise<ClipBatch> {
  if (!input.channelName?.trim()) {
    throw new Error("Name your faceless channel.");
  }

  try {
    const live = await liveBatch(input);
    if (live) return live;
  } catch (err) {
    console.error("Live clip generation failed", err);
  }

  return localBatch(input);
}

export function batchToDownloadText(batch: ClipBatch): string {
  const lines: string[] = [
    `GHOSTCUT — LOOPING RUBE GOLDBERG`,
    `Channel: ${batch.channelName}`,
    `Niche: ${batch.niche}`,
    `Mode: ${batch.mode}`,
    ``,
    `POSTING PLAN`,
    ...batch.postingPlan.map((p, i) => `${i + 1}. ${p}`),
    ``,
  ];

  batch.clips.forEach((clip, idx) => {
    lines.push(`======== CLIP ${idx + 1}: ${clip.hook} ========`);
    lines.push(`Series: ${clip.seriesName}`);
    lines.push(`Duration: ~${clip.durationSec}s`);
    lines.push(`Thumbnail text: ${clip.thumbnailText}`);
    lines.push(`Loop: ${clip.loopNotes}`);
    lines.push(``);
    lines.push(`ANIMATION DIRECTIONS`);
    clip.beats.forEach((b) => {
      lines.push(`[${b.atSec}s] ${b.direction}`);
      if (b.onScreen) lines.push(`         ON SCREEN: ${b.onScreen}`);
    });
    lines.push(``);
    lines.push(`LOOK / SET`);
    clip.broll.forEach((b) => lines.push(`- ${b}`));
    lines.push(``);
    lines.push(`SFX`);
    clip.sfx.forEach((b) => lines.push(`- ${b}`));
    lines.push(``);
    lines.push(`YOUTUBE SHORTS`);
    lines.push(`Title: ${clip.youtube.title}`);
    lines.push(`Description:\n${clip.youtube.description || clip.youtube.caption}`);
    lines.push(
      `Hashtags: ${clip.youtube.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}`,
    );
    lines.push(``);
    lines.push(`INSTAGRAM REELS`);
    lines.push(`Caption:\n${clip.instagram.caption}`);
    lines.push(
      `Hashtags: ${clip.instagram.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}`,
    );
    lines.push(``);
  });

  return lines.join("\n");
}
