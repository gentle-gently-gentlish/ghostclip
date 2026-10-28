import { NextResponse } from "next/server";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { spawn } from "child_process";

export const maxDuration = 60;

function run(
  cmd: string,
  args: string[],
): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.on("close", (code) => resolve({ code: code ?? 1, stderr }));
  });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  const dir = await mkdtemp(join(tmpdir(), "ghostcut-"));
  const input = join(dir, "in.webm");
  const output = join(dir, "out.mp4");

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    await writeFile(input, buf);

    const { code, stderr } = await run("ffmpeg", [
      "-y",
      "-i",
      input,
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      "-an",
      output,
    ]);

    if (code !== 0) {
      console.error(stderr);
      return NextResponse.json(
        { error: "ffmpeg failed", detail: stderr.slice(-500) },
        { status: 500 },
      );
    }

    const mp4 = await readFile(output);
    return new NextResponse(new Uint8Array(mp4), {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": 'attachment; filename="ghostcut-loop.mp4"',
      },
    });
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
