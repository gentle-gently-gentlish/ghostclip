import { connection } from "next/server";
import { NextResponse } from "next/server";
import { getProfile, profileIsComplete } from "@/lib/publish/profile";
import {
  canCompleteOnboarding,
  getOnboarding,
  setOnboardingComplete,
} from "@/lib/publish/store";

export async function POST(request: Request) {
  await connection();
  let reset = false;
  try {
    const body = (await request.json()) as { reset?: boolean };
    reset = Boolean(body?.reset);
  } catch {
    /* empty body ok */
  }

  if (reset) {
    const next = setOnboardingComplete(false);
    return NextResponse.json({
      ok: true,
      onboardingComplete: next.onboardingComplete,
      reset: true,
    });
  }

  const profile = getProfile();
  const gate = canCompleteOnboarding({
    profileOk: profileIsComplete(profile),
    engineOk: true,
  });

  if (!gate.ok) {
    return NextResponse.json(
      {
        error:
          "Cannot finish setup until profile is complete and both YouTube and Instagram are connected with live OAuth (demo does not count).",
        gate,
        onboardingComplete: getOnboarding().onboardingComplete,
      },
      { status: 400 },
    );
  }

  const next = setOnboardingComplete(true);
  return NextResponse.json({
    ok: true,
    onboardingComplete: next.onboardingComplete,
    completedAt: next.completedAt,
    gate,
  });
}

export async function GET() {
  await connection();
  const profile = getProfile();
  const gate = canCompleteOnboarding({
    profileOk: profileIsComplete(profile),
    engineOk: true,
  });
  const onboarding = getOnboarding();
  return NextResponse.json({
    onboardingComplete: onboarding.onboardingComplete,
    completedAt: onboarding.completedAt,
    gate,
  });
}
