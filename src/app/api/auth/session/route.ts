import { NextResponse } from "next/server";
import { getSessionCredentials } from "@/lib/session";

export async function GET() {
  const creds = await getSessionCredentials();
  if (!creds) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    accountId: creds.accountId,
  });
}
