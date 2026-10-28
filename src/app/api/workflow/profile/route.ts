import { connection } from "next/server";
import { NextResponse } from "next/server";
import {
  getProfile,
  profileIsComplete,
  saveProfile,
} from "@/lib/publish/profile";

export async function GET() {
  await connection();
  const profile = getProfile();
  return NextResponse.json({
    profile,
    complete: profileIsComplete(profile),
  });
}

export async function POST(request: Request) {
  await connection();
  const body = (await request.json()) as {
    channelName?: string;
    handle?: string;
    youtubeAbout?: string;
    instagramBio?: string;
  };

  const profile = saveProfile({
    channelName: body.channelName,
    handle: body.handle,
    youtubeAbout: body.youtubeAbout,
    instagramBio: body.instagramBio,
  });

  return NextResponse.json({
    profile,
    complete: profileIsComplete(profile),
  });
}
