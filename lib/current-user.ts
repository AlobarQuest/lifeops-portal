import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

import {
  SESSION_COOKIE,
  getConfiguredEmail,
  verifySessionToken,
} from "@/lib/auth";
import { prisma } from "@/lib/db";

function formatDisplayName(email: string) {
  const [localPart] = email.split("@");

  if (!localPart) {
    return "LifeOps Owner";
  }

  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((segment) => `${segment.slice(0, 1).toUpperCase()}${segment.slice(1)}`)
    .join(" ");
}

async function upsertUser(email: string) {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      displayName: formatDisplayName(email),
      isOwner: email === getConfiguredEmail(),
    },
    select: {
      id: true,
      email: true,
      displayName: true,
      timezone: true,
      isOwner: true,
    },
  });
}

export async function ensureOwnerUser() {
  const ownerEmail = getConfiguredEmail();

  if (!ownerEmail) {
    return null;
  }

  return upsertUser(ownerEmail);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session?.email) {
    return null;
  }

  return upsertUser(session.email.toLowerCase());
}

export async function getApiUser(request: NextRequest) {
  const internalApiToken = process.env.INTERNAL_API_TOKEN ?? "";
  const authorization = request.headers.get("authorization");
  const headerToken = request.headers.get("x-lifeops-token");

  if (
    internalApiToken &&
    (authorization === `Bearer ${internalApiToken}` || headerToken === internalApiToken)
  ) {
    return ensureOwnerUser();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session?.email) {
    return null;
  }

  return upsertUser(session.email.toLowerCase());
}
