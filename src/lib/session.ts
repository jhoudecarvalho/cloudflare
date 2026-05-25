import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";

export const SESSION_COOKIE = "cf_session";
const SESSION_DAYS = 7;

export type SessionCredentials = {
  sessionId: string;
  accountId: string;
  token: string;
};

export async function createSession(
  accountId: string,
  token: string
): Promise<string> {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);

  const session = await prisma.session.create({
    data: {
      accountId,
      tokenEnc: encrypt(token),
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return session.id;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const id = cookieStore.get(SESSION_COOKIE)?.value;
  if (id) {
    await prisma.session.deleteMany({ where: { id } }).catch(() => {});
    cookieStore.delete(SESSION_COOKIE);
  }
}

export async function getSessionCredentials(): Promise<SessionCredentials | null> {
  const cookieStore = await cookies();
  const id = cookieStore.get(SESSION_COOKIE)?.value;
  if (!id) return null;

  const session = await prisma.session.findUnique({ where: { id } });
  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.session.delete({ where: { id } }).catch(() => {});
    cookieStore.delete(SESSION_COOKIE);
    return null;
  }

  await prisma.session.update({
    where: { id },
    data: { lastUsedAt: new Date() },
  });

  return {
    sessionId: session.id,
    accountId: session.accountId,
    token: decrypt(session.tokenEnc),
  };
}
