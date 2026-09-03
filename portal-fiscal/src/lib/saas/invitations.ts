import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import type { MemberRole } from "@/generated/prisma/client";
import { logAuditEntry } from "@/lib/auth/session";

const INVITATION_HOURS = 72;

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export type CreateInvitationInput = {
  organizationId: string;
  createdById: string;
  email: string;
  role?: MemberRole;
};

export async function createInvitation(input: CreateInvitationInput) {
  const emailClean = input.email.toLowerCase().trim();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITATION_HOURS * 60 * 60_000);

  // Invalida convites pendentes antigos para o mesmo email e org
  await db.invitation.deleteMany({
    where: {
      organizationId: input.organizationId,
      email: emailClean,
      usedAt: null,
    },
  });

  const invitation = await db.invitation.create({
    data: {
      organizationId: input.organizationId,
      createdById: input.createdById,
      email: emailClean,
      role: input.role || "VIEWER",
      tokenHash: tokenHash(token),
      expiresAt,
    },
  });

  await logAuditEntry({
    action: "TEAM_INVITATION_CREATED",
    entityType: "INVITATION",
    entityId: invitation.id,
    organizationId: input.organizationId,
    userId: input.createdById,
    metadata: { email: emailClean, role: invitation.role },
  });

  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    expiresAt: invitation.expiresAt,
    token: process.env.NODE_ENV !== "production" ? token : undefined,
  };
}

export async function acceptInvitation(token: string, userId: string) {
  const record = await db.invitation.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { organization: true },
  });

  if (!record || record.usedAt || record.expiresAt <= new Date()) {
    throw new Error("Convite inválido, expirado ou já utilizado.");
  }

  await db.$transaction([
    db.membership.upsert({
      where: {
        organizationId_userId: {
          organizationId: record.organizationId,
          userId,
        },
      },
      update: { role: record.role },
      create: {
        organizationId: record.organizationId,
        userId,
        role: record.role,
      },
    }),
    db.invitation.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);

  await logAuditEntry({
    action: "TEAM_INVITATION_ACCEPTED",
    entityType: "INVITATION",
    entityId: record.id,
    organizationId: record.organizationId,
    userId,
    metadata: { role: record.role },
  });

  return { success: true, organizationName: record.organization.name, role: record.role };
}
