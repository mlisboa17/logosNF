import "server-only";
import { db } from "@/lib/db";

export type QuotaCheckResult = {
  allowed: boolean;
  resource: "companies" | "documents";
  currentCount: number;
  limit: number;
  message?: string;
};

export async function checkTenantQuota(
  organizationId: string,
  resource: "companies" | "documents"
): Promise<QuotaCheckResult> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      plan: true,
      subscriptionStatus: true,
      maxCompanies: true,
      maxMonthlyDocuments: true,
    },
  });

  if (!org) {
    throw new Error("Organização não encontrada.");
  }

  if (org.subscriptionStatus === "SUSPENDED" || org.subscriptionStatus === "CANCELED") {
    return {
      allowed: false,
      resource,
      currentCount: 0,
      limit: 0,
      message: "Assinatura suspensa ou cancelada. Regularize a cobrança para liberar novas operações.",
    };
  }

  if (resource === "companies") {
    const currentCount = await db.company.count({
      where: { organizationId },
    });

    const allowed = currentCount < org.maxCompanies;
    return {
      allowed,
      resource: "companies",
      currentCount,
      limit: org.maxCompanies,
      message: allowed ? undefined : `Limite de empresas atingido para o plano ${org.plan} (${currentCount}/${org.maxCompanies}).`,
    };
  }

  // Medição mensal de documentos
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const currentCount = await db.fiscalDocument.count({
    where: {
      company: { organizationId },
      createdAt: { gte: startOfMonth },
    },
  });

  const allowed = currentCount < org.maxMonthlyDocuments;
  return {
    allowed,
    resource: "documents",
    currentCount,
    limit: org.maxMonthlyDocuments,
    message: allowed ? undefined : `Limite mensal de captura de documentos atingido (${currentCount}/${org.maxMonthlyDocuments}).`,
  };
}

export async function enforceTenantIsolation(userId: string, targetOrganizationId: string) {
  const membership = await db.membership.findUnique({
    where: {
      organizationId_userId: {
        organizationId: targetOrganizationId,
        userId,
      },
    },
  });

  if (!membership) {
    throw new Error("Acesso negado: o usuário não pertence a esta organização.");
  }

  return membership;
}
