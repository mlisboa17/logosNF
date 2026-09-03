import "server-only";
import { db } from "@/lib/db";
import { logAuditEntry } from "@/lib/auth/session";

export async function exportUserDataLgpd(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        include: { organization: true },
      },
      auditEntries: {
        take: 500,
        orderBy: { createdAt: "desc" },
      },
      sessions: {
        select: { id: true, createdAt: true, expiresAt: true },
      },
    },
  });

  if (!user) {
    throw new Error("Usuário não encontrado.");
  }

  await logAuditEntry({
    action: "LGPD_DATA_EXPORTED",
    entityType: "USER",
    entityId: userId,
    userId,
  });

  return {
    lgpdReportVersion: "1.0",
    exportedAt: new Date().toISOString(),
    personalData: {
      id: user.id,
      name: user.name,
      email: user.email,
      termsAcceptedAt: user.termsAcceptedAt ? user.termsAcceptedAt.toISOString() : null,
      privacyAcceptedAt: user.privacyAcceptedAt ? user.privacyAcceptedAt.toISOString() : null,
      twoFactorEnabled: user.twoFactorEnabled,
      createdAt: user.createdAt.toISOString(),
    },
    organizations: user.memberships.map((m) => ({
      organizationId: m.organizationId,
      organizationName: m.organization.name,
      role: m.role,
    })),
    recentSessionsCount: user.sessions.length,
    auditHistory: user.auditEntries.map((entry) => ({
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      timestamp: entry.createdAt.toISOString(),
      metadata: entry.metadata,
    })),
  };
}

export async function recordConsent(userId: string, consentType: "terms" | "privacy") {
  const dataToUpdate =
    consentType === "terms" ? { termsAcceptedAt: new Date() } : { privacyAcceptedAt: new Date() };

  await db.user.update({
    where: { id: userId },
    data: dataToUpdate,
  });

  await logAuditEntry({
    action: `LGPD_CONSENT_${consentType.toUpperCase()}_ACCEPTED`,
    entityType: "USER",
    entityId: userId,
    userId,
  });

  return { success: true, consentType, timestamp: new Date().toISOString() };
}
