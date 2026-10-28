import { BRAND, CHANNEL_NAME, HANDLE } from "@/lib/brand";
import { dbGetProfile, dbSaveProfile } from "./db";

export type ChannelProfile = {
  channelName: string;
  handle: string;
  youtubeAbout: string;
  instagramBio: string;
  updatedAt?: string;
};

export function defaultProfile(): ChannelProfile {
  return {
    channelName: CHANNEL_NAME,
    handle: HANDLE,
    youtubeAbout: BRAND.youtube.description,
    instagramBio: BRAND.instagram.bio,
  };
}

export function getProfile(): ChannelProfile {
  const fromDb = dbGetProfile();
  if (!fromDb) return defaultProfile();
  return { ...defaultProfile(), ...fromDb };
}

export function saveProfile(patch: Partial<ChannelProfile>): ChannelProfile {
  const next: ChannelProfile = {
    ...getProfile(),
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  dbSaveProfile(next);
  return next;
}

export function profileIsComplete(p: ChannelProfile) {
  return (
    p.channelName.trim().length >= 2 &&
    p.handle.trim().length >= 2 &&
    p.youtubeAbout.trim().length >= 40 &&
    p.instagramBio.trim().length >= 10
  );
}
