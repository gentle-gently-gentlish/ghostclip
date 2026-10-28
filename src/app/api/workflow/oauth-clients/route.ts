import { connection } from "next/server";
import { NextResponse } from "next/server";
import {
  oauthClientsPublic,
  saveOAuthClients,
} from "@/lib/publish/secrets";
import { getOAuthRedirectUris } from "@/lib/publish/store";

export async function GET() {
  await connection();
  return NextResponse.json({
    clients: oauthClientsPublic(),
    redirectUris: getOAuthRedirectUris(),
  });
}

export async function POST(request: Request) {
  await connection();
  const body = (await request.json()) as {
    googleClientId?: string;
    googleClientSecret?: string;
    metaAppId?: string;
    metaAppSecret?: string;
  };

  const hasAny =
    body.googleClientId !== undefined ||
    body.googleClientSecret !== undefined ||
    body.metaAppId !== undefined ||
    body.metaAppSecret !== undefined;

  if (!hasAny) {
    return NextResponse.json(
      { error: "Provide at least one OAuth client field" },
      { status: 400 },
    );
  }

  saveOAuthClients({
    googleClientId: body.googleClientId,
    googleClientSecret: body.googleClientSecret,
    metaAppId: body.metaAppId,
    metaAppSecret: body.metaAppSecret,
  });

  return NextResponse.json({
    ok: true,
    clients: oauthClientsPublic(),
    redirectUris: getOAuthRedirectUris(),
  });
}
