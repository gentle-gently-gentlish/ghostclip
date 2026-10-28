import { connection } from "next/server";
import { NextResponse } from "next/server";
import { publishApprovedItem } from "@/lib/publish/publish";
import { getQueueItem, toPublicQueueItem } from "@/lib/publish/store";
import type { Platform } from "@/lib/publish/types";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: Ctx) {
  await connection();
  const { id } = await ctx.params;
  const item = getQueueItem(id);
  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (item.status === "posted" || item.status === "posting") {
    return NextResponse.json(
      { error: `Already ${item.status}` },
      { status: 409 },
    );
  }
  if (item.status === "rejected") {
    return NextResponse.json(
      { error: "Rejected items cannot be approved — re-queue a new render" },
      { status: 409 },
    );
  }

  let platforms: Platform[] | undefined;
  try {
    const body = (await request.json()) as { platforms?: Platform[] };
    platforms = body.platforms;
  } catch {
    /* empty body ok */
  }

  try {
    const updated = await publishApprovedItem(id, platforms);
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ item: toPublicQueueItem(updated) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Publish failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
