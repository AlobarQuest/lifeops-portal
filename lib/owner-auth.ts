import { getConfiguredEmail, getConfiguredPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";

const DEFAULT_OWNER_DISPLAY_NAME = "Devon Watkins";

export type OwnerLoginResult =
  | { ok: true; email: string }
  | { ok: false; reason: "invalid" | "missing-bootstrap-password" };

function getOwnerEmail() {
  return getConfiguredEmail();
}

async function findOwnerUser(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      displayName: true,
      isOwner: true,
      passwordHash: true,
      passwordUpdatedAt: true,
    },
  });
}

async function persistBootstrapPassword(email: string, password: string, displayName?: string | null) {
  const passwordHash = hashPassword(password);
  const passwordUpdatedAt = new Date();

  await prisma.user.upsert({
    where: { email },
    update: {
      isOwner: true,
      displayName: displayName?.trim() || DEFAULT_OWNER_DISPLAY_NAME,
      passwordHash,
      passwordUpdatedAt,
    },
    create: {
      email,
      displayName: displayName?.trim() || DEFAULT_OWNER_DISPLAY_NAME,
      isOwner: true,
      passwordHash,
      passwordUpdatedAt,
    },
  });
}

export async function verifyOwnerLogin(email: string, password: string): Promise<OwnerLoginResult> {
  const ownerEmail = getOwnerEmail();

  if (!ownerEmail || email !== ownerEmail) {
    return { ok: false, reason: "invalid" };
  }

  const owner = await findOwnerUser(ownerEmail);

  if (owner?.passwordHash) {
    return verifyPassword(password, owner.passwordHash) ? { ok: true, email: ownerEmail } : { ok: false, reason: "invalid" };
  }

  const bootstrapPassword = getConfiguredPassword();

  if (!bootstrapPassword) {
    return { ok: false, reason: "missing-bootstrap-password" };
  }

  if (password !== bootstrapPassword) {
    return { ok: false, reason: "invalid" };
  }

  await persistBootstrapPassword(ownerEmail, password, owner?.displayName);

  return { ok: true, email: ownerEmail };
}

export async function changeOwnerPassword(email: string, currentPassword: string, nextPassword: string) {
  const owner = await findOwnerUser(email);

  if (!owner || !owner.isOwner) {
    return { ok: false as const, reason: "not-found" };
  }

  if (!owner.passwordHash) {
    const bootstrapPassword = getConfiguredPassword();

    if (!bootstrapPassword || currentPassword !== bootstrapPassword) {
      return { ok: false as const, reason: "invalid-current-password" };
    }
  } else if (!verifyPassword(currentPassword, owner.passwordHash)) {
    return { ok: false as const, reason: "invalid-current-password" };
  }

  await prisma.user.update({
    where: { id: owner.id },
    data: {
      passwordHash: hashPassword(nextPassword),
      passwordUpdatedAt: new Date(),
      isOwner: true,
    },
  });

  return { ok: true as const };
}
