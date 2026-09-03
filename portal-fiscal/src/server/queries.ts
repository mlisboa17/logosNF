import "server-only";
import { db } from "@/lib/db";
import type { DocumentKind, ManifestationStatus, Prisma } from "@/generated/prisma/client";

/**
 * Query otimizada para home page
 * Consolidada em uma única estrutura para evitar N+1
 */
export async function getHomePageData(organizationIds: string[], selectedCompanyId?: string) {
  const documentWhere = {
    company: { organizationId: { in: organizationIds } },
    ...(selectedCompanyId ? { companyId: selectedCompanyId } : {}),
  };

  // 1️⃣ Uma única query paralela consolidada
  const [companies, documents, counts, members, auditEntries] = await Promise.all([
    // Query 1: Empresas com dados relacionados
    db.company.findMany({
      where: { organizationId: { in: organizationIds } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        legalName: true,
        tradeName: true,
        cnpj: true,
        status: true,
        nfseEnvironment: true,
        _count: { select: { documents: true } },
        cursors: {
          select: { source: true, lastNsu: true, lastSyncAt: true },
        },
        syncRuns: {
          orderBy: { startedAt: "desc" },
          take: 1,
          select: {
            status: true,
            documentCount: true,
            errorMessage: true,
            startedAt: true,
            finishedAt: true,
          },
        },
        certificate: {
          select: {
            validUntil: true,
            fingerprint: true,
            subject: true,
          },
        },
      },
    }),

    // Query 2: Documentos recentes
    db.fiscalDocument.findMany({
      where: documentWhere,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        kind: true,
        accessKey: true,
        nsu: true,
        issuedAt: true,
        totalAmount: true,
        manifestationStatus: true,
        lastDownloadedAt: true,
        rawMetadata: true,
        company: { select: { id: true, legalName: true } },
      },
    }),

    // Query 3: Contagem consolidada (usar agregação)
    db.fiscalDocument.groupBy({
      by: ["kind"],
      where: documentWhere,
      _count: true,
    }),

    // Query 4: Membros
    db.membership.findMany({
      where: { organizationId: { in: organizationIds } },
      select: {
        userId: true,
        role: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { role: "asc" },
    }),

    // Query 5: Auditoria
    db.auditEntry.findMany({
      where: { organizationId: { in: organizationIds } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
        metadata: true,
      },
    }),
  ]);

  // Processa dados para consumo na UI
  const totalDocuments = documents.length;
  const eventCount = counts.find((c) => c.kind === "NFSE_EVENT" || c.kind === "NFE_EVENT")?._count || 0;
  const totalDocumentsCount = counts.reduce((sum, c) => sum + c._count, 0);

  const readyCompanies = companies.filter((c) => c.status === "READY").length;
  const failedCompanies = companies.filter((c) => c.syncRuns[0]?.status === "FAILED").length;

  const certificateWarningDate = new Date(Date.now() + 30 * 24 * 60 * 60_000);
  const expiringCertificates = companies.filter(
    (c) => c.certificate && c.certificate.validUntil <= certificateWarningDate
  ).length;

  const lastSyncAt = companies
    .flatMap((c) => c.cursors.map((cur) => cur.lastSyncAt))
    .filter((date): date is Date => date !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  return {
    companies,
    documents,
    members: members.map((m) => ({
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
    })),
    auditEntries: auditEntries.map((e) => ({
      id: e.id,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId,
      createdAt: e.createdAt.toISOString(),
      userName: e.user?.name || "Sistema",
      userEmail: e.user?.email || "—",
      metadata: e.metadata,
    })),

    // Métricas calculadas
    metrics: {
      documentCount: totalDocumentsCount,
      eventCount,
      readyCompanies,
      failedCompanies,
      expiringCertificates,
      lastSyncAt: lastSyncAt?.toISOString() ?? null,
    },
  };
}

/**
 * Query para sincronização de empresa
 */
export async function getCompanyForSync(companyId: string) {
  return db.company.findUnique({
    where: { id: companyId },
    select: {
      id: true,
      legalName: true,
      cnpj: true,
      status: true,
      nfseEnvironment: true,
      certificate: {
        select: {
          secretKey: true,
          subject: true,
          validUntil: true,
        },
      },
      cursors: {
        select: {
          source: true,
          lastNsu: true,
          lastSyncAt: true,
        },
      },
    },
  });
}

export type PaginatedDocument = {
  id: string;
  kind: DocumentKind;
  accessKey: string | null;
  nsu: bigint;
  issuedAt: Date | null;
  totalAmount: number | null;
  manifestationStatus: string | null;
  lastDownloadedAt: Date | null;
  rawMetadata: string | null;
  company: {
    id: string;
    legalName: string;
    cnpj: string;
  };
};

/**
 * Query para buscar documentos com paginação cursor-based
 * Mais eficiente que offset para grandes datasets
 */
export async function getDocumentsPaginated(
  organizationIds: string[],
  filters: {
    companyId?: string;
    kind?: string;
    manifestationStatus?: string;
    issuedAfter?: Date;
    issuedBefore?: Date;
  } = {},
  options: {
    cursor?: string; // ID do último documento da página anterior
    limit?: number;
    direction?: "next" | "prev";
  } = {}
): Promise<{
  documents: PaginatedDocument[];
  nextCursor: string | null;
  hasMore: boolean;
  pageSize: number;
}> {
  const limit = options.limit || 25; // Padrão: 25 por página
  const direction = options.direction || "next";

  const where: Prisma.FiscalDocumentWhereInput = {
    company: { organizationId: { in: organizationIds } },
    ...(filters.companyId ? { companyId: filters.companyId } : {}),
    ...(filters.kind ? { kind: filters.kind as DocumentKind } : {}),
    ...(filters.manifestationStatus ? { manifestationStatus: filters.manifestationStatus as ManifestationStatus } : {}),
    ...(filters.issuedAfter || filters.issuedBefore
      ? {
          issuedAt: {
            ...(filters.issuedAfter ? { gte: filters.issuedAfter } : {}),
            ...(filters.issuedBefore ? { lte: filters.issuedBefore } : {}),
          },
        }
      : {}),
  };

  // Buscar limit + 1 para determinar se há mais páginas
  const documents = await db.fiscalDocument.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(options.cursor ? { skip: 1, cursor: { id: options.cursor } } : {}),
    select: {
      id: true,
      kind: true,
      accessKey: true,
      nsu: true,
      issuedAt: true,
      totalAmount: true,
      manifestationStatus: true,
      lastDownloadedAt: true,
      rawMetadata: true,
      company: { select: { id: true, legalName: true, cnpj: true } },
    },
  });

  const hasMore = documents.length > limit;
  const pageDocuments = documents.slice(0, limit);
  const nextCursor = hasMore ? pageDocuments[pageDocuments.length - 1]?.id : null;

  return {
    documents: pageDocuments,
    nextCursor,
    hasMore,
    pageSize: limit,
  };
}
