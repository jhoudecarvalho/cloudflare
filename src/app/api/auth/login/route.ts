import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/session";
import { proxyToCloudflare } from "@/lib/cloudflare";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const accountId = body?.accountId?.trim();
  const token = body?.token?.trim();

  if (!accountId || !token) {
    return NextResponse.json(
      { success: false, message: "Account ID e API Token são obrigatórios" },
      { status: 400 }
    );
  }

  const verify = await proxyToCloudflare(
    "GET",
    `/accounts/${accountId}/tokens/verify`,
    `Bearer ${token}`
  );
  const data = await verify.json();

  if (!verify.ok || !data.success) {
    return NextResponse.json(
      {
        success: false,
        message: data.errors?.[0]?.message || "Token inválido",
      },
      { status: 401 }
    );
  }

  await createSession(accountId, token);
  return NextResponse.json({ success: true });
}
