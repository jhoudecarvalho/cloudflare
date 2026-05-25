import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionCredentials } from "@/lib/session";

export async function POST(req: NextRequest) {
  const creds = await getSessionCredentials();
  if (!creds) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.action) {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  await prisma.auditLog.create({
    data: {
      sessionId: creds.sessionId,
      action: body.action,
      oldIp: body.oldIp ?? null,
      newIp: body.newIp ?? null,
      scope: body.scope ?? null,
      total: body.total ?? 0,
      success: body.success ?? 0,
      failed: body.failed ?? 0,
      details: body.details ?? null,
    },
  });

  return NextResponse.json({ success: true });
}
