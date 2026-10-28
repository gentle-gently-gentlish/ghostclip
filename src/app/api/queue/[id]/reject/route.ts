import { connection } from "next/server";
import { NextResponse } from "next/server";
import {
  getQueueItem,
  toPublicQueueItem,
  updateQueueStatus,
} from "@/lib/publish/store";

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
      { error: `Cannot reject while ${item.status}` },
      { status: 409 },
    );
  }

  let reason = "Looks like slop — regenerate";
  try {
    const body = (await request.json()) as { reason?: string };
    if (body.reason?.trim()) reason = body.reason.trim();
  } catch {
    /* ok */
  }

  const updated = updateQueueStatus(id, "rejected", { rejectReason: reason });
  return NextResponse.json({ item: toPublicQueueItem(updated!) });
}
