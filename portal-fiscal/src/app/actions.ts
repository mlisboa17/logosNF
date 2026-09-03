"use server";

import { revalidatePath } from "next/cache";
import { createHash, randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { parsePfx, validateCnpj } from "open-nfse";
import { db } from "@/lib/db";
import { normalizeCnpj } from "@/lib/fiscal/cnpj";
import { syncCompanyNfseById } from "@/lib/fiscal/sync-nfse";
import { syncCompanyNfeById } from "@/lib/fiscal/sync-nfe";
import { hashPassword } from "@/lib/auth/password";
import { requireCompanyOperator, requireFiscalOperator, requireAdmin, logAuditEntry, authSession } from "@/lib/auth/session";
import { sendSefazManifestation, type ManifestationType } from "@/lib/fiscal/sefaz/manifestation";
import { storeEncryptedCertificate } from "@/lib/security/certificate-vault";
import type { MemberRole } from "@/generated/prisma/client";

export type CertificateImportState = { ok: boolean; message: string };

function safeRevalidatePath(targetPath: string) {
  try {
    revalidatePath(targetPath);
  } catch {
    // Ignorar erro de escopo ao rodar em testes fora do servidor Next.js
  }
}

function cnpjFromSubject(subject: string): string {
  const matches = subject.match(/\d{14}/g) ?? [];
  for (const candidate of matches) {
    try {
      validateCnpj(candidate);
      return candidate;
    } catch {}
  }
  throw new Error("O certificado não contém um CNPJ válido no titular.");
}

function legalNameFromSubject(subject: string): string {
  const name = subject.replace(/:\d{14}.*$/, "").trim();
  return name || "Empresa importada pelo certificado";
}

export async function importCompanyFromCertificate(
  _previousState: CertificateImportState,
  formData: FormData,
): Promise<CertificateImportState> {
  await requireFiscalOperator();
  const file = formData.get("certificate");
  const password = String(formData.get("password") ?? "");

  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Selecione o certificado A1." };
  if (file.size > 5 * 1024 * 1024) return { ok: false, message: "O certificado excede o limite de 5 MB." };
  if (!password) return { ok: false, message: "Informe a senha do certificado." };

  const pfx = Buffer.from(await file.arrayBuffer());
  let secretKey: string | null = null;

  try {
    const certificate = parsePfx(pfx, password);
    const cnpj = cnpjFromSubject(certificate.subject);
    const legalName = legalNameFromSubject(certificate.subject);
    const fingerprint = createHash("sha256").update(certificate.certPem).digest("hex");
    const secretId = randomUUID();
    secretKey = await storeEncryptedCertificate({ id: secretId, pfx, password });

    const organization = await db.organization.upsert({
      where: { id: "internal-organization" },
      update: {},
      create: { id: "internal-organization", name: "Organização principal" },
    });

    const company = await db.company.upsert({
      where: { cnpj },
      update: {
        legalName,
        status: "READY",
        certificate: {
          upsert: {
            create: {
              secretProvider: "LOCAL_ENCRYPTED_VAULT",
              secretKey,
              fingerprint,
              subject: certificate.subject,
              validFrom: certificate.issuedOn,
              validUntil: certificate.expiresOn,
            },
            update: {
              secretProvider: "LOCAL_ENCRYPTED_VAULT",
              secretKey,
              fingerprint,
              subject: certificate.subject,
              validFrom: certificate.issuedOn,
              validUntil: certificate.expiresOn,
            },
          },
        },
      },
      create: {
        organizationId: organization.id,
        legalName,
        cnpj,
        status: "READY",
        certificate: {
          create: {
            secretProvider: "LOCAL_ENCRYPTED_VAULT",
            secretKey,
            fingerprint,
            subject: certificate.subject,
            validFrom: certificate.issuedOn,
            validUntil: certificate.expiresOn,
          },
        },
        cursors: { create: { source: "ADN_NFSE_RESTRICTED", lastNsu: 0 } },
      },
    });

    await logAuditEntry({
      action: "CERTIFICATE_IMPORT",
      entityType: "Company",
      entityId: company.id,
      metadata: { cnpj, legalName, fingerprint },
    });

    revalidatePath("/");
    return { ok: true, message: `Empresa ${legalName} adicionada pelo certificado.` };
  } catch (error) {
    if (secretKey) {
      await unlink(path.join(process.cwd(), ".vault", secretKey)).catch(() => undefined);
    }
    const message = error instanceof Error ? error.message : "Não foi possível importar o certificado.";
    return { ok: false, message };
  } finally {
    pfx.fill(0);
  }
}

export async function createCompany(formData: FormData) {
  await requireFiscalOperator();
  const legalName = String(formData.get("legalName") ?? "").trim();
  const tradeName = String(formData.get("tradeName") ?? "").trim();
  const cnpj = normalizeCnpj(String(formData.get("cnpj") ?? ""));

  if (legalName.length < 3 || legalName.length > 180) {
    throw new Error("A razão social deve ter entre 3 e 180 caracteres.");
  }

  const organization = await db.organization.upsert({
    where: { id: "internal-organization" },
    update: {},
    create: { id: "internal-organization", name: "Organização principal" },
  });

  const company = await db.company.create({
    data: {
      organizationId: organization.id,
      legalName,
      tradeName: tradeName || null,
      cnpj,
      cursors: { create: { source: "ADN_NFSE_RESTRICTED", lastNsu: 0 } },
    },
  });

  await logAuditEntry({
    action: "COMPANY_CREATE",
    entityType: "Company",
    entityId: company.id,
    metadata: { cnpj, legalName, tradeName },
  });

  safeRevalidatePath("/");
}

export async function syncCompanyNfse(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "");
  if (!companyId) throw new Error("Empresa não informada.");
  await requireCompanyOperator(companyId);
  const result = await syncCompanyNfseById(companyId);
  await logAuditEntry({
    action: "COMPANY_SYNC_MANUAL",
    entityType: "Company",
    entityId: companyId,
    metadata: { result },
  });
  if (result.status === "FAILED") throw new Error(result.message ?? "Falha na sincronização.");
  safeRevalidatePath("/");
}

export async function syncCompanyNfe(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "");
  if (!companyId) throw new Error("Empresa não informada.");
  await requireCompanyOperator(companyId);
  const result = await syncCompanyNfeById(companyId);
  await logAuditEntry({
    action: "COMPANY_SYNC_NFE_MANUAL",
    entityType: "Company",
    entityId: companyId,
    metadata: { result },
  });
  if (result.status === "FAILED") throw new Error(result.message ?? "Falha na sincronização NF-e.");
  safeRevalidatePath("/");
}

export async function setCompanyNfseEnvironment(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "");
  await requireCompanyOperator(companyId);
  const target = String(formData.get("target") ?? "");
  const company = await db.company.findUnique({
    where: { id: companyId },
    include: {
      certificate: true,
      syncRuns: { where: { source: "ADN_NFSE_RESTRICTED", status: "SUCCEEDED" }, take: 1 },
    },
  });
  if (!company) throw new Error("Empresa não encontrada.");

  if (target === "PRODUCTION") {
    if (!company.certificate) throw new Error("Vincule um A1 antes de liberar a produção.");
    if (company.syncRuns.length === 0) throw new Error("Faça um teste ADN bem-sucedido antes de liberar a produção.");
    await db.$transaction([
      db.company.update({ where: { id: companyId }, data: { nfseEnvironment: "PRODUCTION" } }),
      db.syncCursor.upsert({
        where: { companyId_source: { companyId, source: "ADN_NFSE_PRODUCTION" } },
        update: {},
        create: { companyId, source: "ADN_NFSE_PRODUCTION", lastNsu: 0 },
      }),
    ]);
  } else {
    await db.company.update({ where: { id: companyId }, data: { nfseEnvironment: "RESTRICTED" } });
  }
  await logAuditEntry({
    action: "COMPANY_SET_ENVIRONMENT",
    entityType: "Company",
    entityId: companyId,
    metadata: { environment: target },
  });
  safeRevalidatePath("/");
}

export async function createUserMember(formData: FormData) {
  const adminSession = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "VIEWER") as MemberRole;

  if (name.length < 3 || !/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error("Informe nome e e-mail válidos.");
  }
  if (password.length < 12) {
    throw new Error("A senha inicial deve ter ao menos 12 caracteres.");
  }

  const organizationId = adminSession.user.memberships[0]?.organizationId || "internal-organization";
  const passwordHash = await hashPassword(password);

  const existingUser = await db.user.findUnique({ where: { email } });
  let userId = existingUser?.id;

  if (!existingUser) {
    const newUser = await db.user.create({
      data: {
        name,
        email,
        passwordHash,
      },
    });
    userId = newUser.id;
  }

  await db.membership.upsert({
    where: { organizationId_userId: { organizationId, userId: userId! } },
    update: { role },
    create: { organizationId, userId: userId!, role },
  });

  await logAuditEntry({
    action: "MEMBER_CREATE",
    entityType: "Membership",
    entityId: userId,
    metadata: { email, role, organizationId },
  });

  safeRevalidatePath("/");
}

export async function updateMemberRole(formData: FormData) {
  const adminSession = await requireAdmin();
  const targetUserId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "VIEWER") as MemberRole;
  const organizationId = adminSession.user.memberships[0]?.organizationId || "internal-organization";

  if (!targetUserId) throw new Error("Usuário não informado.");

  await db.membership.update({
    where: { organizationId_userId: { organizationId, userId: targetUserId } },
    data: { role },
  });

  await logAuditEntry({
    action: "MEMBER_ROLE_UPDATE",
    entityType: "Membership",
    entityId: targetUserId,
    metadata: { newRole: role, organizationId },
  });

  safeRevalidatePath("/");
}

export async function removeMember(formData: FormData) {
  const adminSession = await requireAdmin();
  const targetUserId = String(formData.get("userId") ?? "");
  const organizationId = adminSession.user.memberships[0]?.organizationId || "internal-organization";

  if (!targetUserId) throw new Error("Usuário não informado.");
  if (targetUserId === adminSession.userId) throw new Error("Não é possível remover seu próprio usuário.");

  await db.membership.delete({
    where: { organizationId_userId: { organizationId, userId: targetUserId } },
  });

  await logAuditEntry({
    action: "MEMBER_REMOVE",
    entityType: "Membership",
    entityId: targetUserId,
    metadata: { organizationId },
  });

  safeRevalidatePath("/");
}

export async function updateDocumentMetadata(formData: FormData) {
  const session = await authSession.requireFiscalOperator();
  const documentId = String(formData.get("documentId") ?? "");
  const tagsStr = String(formData.get("tags") ?? "").trim();
  const internalComment = String(formData.get("internalComment") ?? "").trim();
  const assignedTo = String(formData.get("assignedTo") ?? "").trim();

  if (!documentId) throw new Error("Documento não informado.");

  const doc = await db.fiscalDocument.findFirst({
    where: {
      id: documentId,
      company: { organizationId: { in: session.user.memberships.map((m) => m.organizationId) } },
    },
  });

  if (!doc) throw new Error("Documento não encontrado ou acesso negado.");

  const tags = tagsStr ? tagsStr.split(",").map((t) => t.trim()).filter(Boolean) : [];
  const oldMeta = doc.rawMetadata ? (JSON.parse(doc.rawMetadata) as Record<string, any>) : {};

  await db.fiscalDocument.update({
    where: { id: doc.id },
    data: {
      rawMetadata: JSON.stringify({
        ...oldMeta,
        tags,
        internalComment,
        assignedTo,
      }),
    },
  });

  await logAuditEntry({
    action: "DOCUMENT_METADATA_UPDATE",
    entityType: "FiscalDocument",
    entityId: doc.id,
    metadata: { tags, internalComment, assignedTo },
  });

  safeRevalidatePath("/");
}

export async function manifestDocument(formData: FormData) {
  const session = await authSession.requireFiscalOperator();
  const documentId = String(formData.get("documentId") ?? "");
  const eventType = String(formData.get("eventType") ?? "") as ManifestationType;
  const justification = String(formData.get("justification") ?? "").trim();

  if (!documentId) throw new Error("Documento não informado.");
  if (!eventType) throw new Error("Tipo de evento não informado.");

  const doc = await db.fiscalDocument.findFirst({
    where: {
      id: documentId,
      company: { organizationId: { in: session.user.memberships.map((m) => m.organizationId) } },
    },
    include: { company: true },
  });

  if (!doc) throw new Error("Documento não encontrado ou acesso negado.");
  if (doc.kind !== "NFE") throw new Error("Manifestação aplicável apenas para NF-e de mercadorias.");
  if (!doc.accessKey) throw new Error("Chave de acesso não encontrada no documento.");

  const sefazResult = await sendSefazManifestation({
    companyCnpj: doc.company.cnpj,
    accessKey: doc.accessKey,
    eventType,
    justification,
  });

  await db.fiscalDocument.update({
    where: { id: doc.id },
    data: {
      manifestationStatus: sefazResult.dbStatus,
      manifestedAt: new Date(sefazResult.registeredAt),
    },
  });

  await logAuditEntry({
    action: "DOCUMENT_MANIFESTATION",
    entityType: "FiscalDocument",
    entityId: doc.id,
    organizationId: doc.company.organizationId,
    userId: session.userId,
    metadata: {
      eventType,
      protocol: sefazResult.protocolNumber,
      sefazStat: sefazResult.sefazStat,
      justification,
    },
  });

  const meta = doc.rawMetadata ? (JSON.parse(doc.rawMetadata) as Record<string, any>) : {};
  if ((sefazResult.dbStatus === "SCIENCE" || sefazResult.dbStatus === "CONFIRMED") && meta.isSummary && doc.accessKey) {
    try {
      await syncCompanyNfeById(doc.companyId);
    } catch (syncError) {
      console.error("FALHA_AO_BAIXAR_PROC_NFE_POS_MANIFESTACAO", syncError);
    }
  }

  safeRevalidatePath("/");

  return {
    ok: true,
    message: sefazResult.message,
    protocol: sefazResult.protocolNumber,
    status: sefazResult.dbStatus,
  };
}

export async function manifestDocumentsBatch(formData: FormData) {
  const session = await authSession.requireFiscalOperator();
  const rawIds = String(formData.get("documentIds") ?? "");
  const eventType = String(formData.get("eventType") ?? "") as ManifestationType;

  const ids = rawIds.split(",").map((i) => i.trim()).filter(Boolean);
  if (ids.length === 0) throw new Error("Nenhum documento selecionado.");

  let successCount = 0;
  const errors: string[] = [];

  for (const documentId of ids) {
    try {
      const singleFormData = new FormData();
      singleFormData.append("documentId", documentId);
      singleFormData.append("eventType", eventType);
      await manifestDocument(singleFormData);
      successCount++;
    } catch (err) {
      errors.push(`Doc ${documentId}: ${err instanceof Error ? err.message : "Falha na manifestação"}`);
    }
  }

  safeRevalidatePath("/");

  return {
    ok: successCount > 0,
    processed: ids.length,
    successCount,
    errors,
  };
}
