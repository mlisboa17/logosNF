import test from "node:test";
import assert from "node:assert/strict";
import { db } from "../src/lib/db";
import { checkTenantQuota, enforceTenantIsolation } from "../src/lib/saas/tenant";
import { createInvitation, acceptInvitation } from "../src/lib/saas/invitations";
import { exportUserDataLgpd, recordConsent } from "../src/lib/saas/lgpd";
import { generateMfaSecret, verifyMfaCode, enableUserMfa } from "../src/lib/auth/mfa";
import { hashPassword } from "../src/lib/auth/password";

test("Multi-tenant: isolamento entre organizações distintas", async () => {
  const orgA = await db.organization.create({ data: { name: "Org Tenant A" } });
  const orgB = await db.organization.create({ data: { name: "Org Tenant B" } });

  const passwordHash = await hashPassword("TenantPassword123!");
  const userA = await db.user.create({
    data: {
      name: "Usuario Org A",
      email: `user-orga-${Date.now()}@example.com`,
      passwordHash,
      memberships: { create: { organizationId: orgA.id, role: "OWNER" } },
    },
  });

  try {
    // Pertence à Org A -> Acesso permitido
    const membershipA = await enforceTenantIsolation(userA.id, orgA.id);
    assert.equal(membershipA.organizationId, orgA.id);

    // Tenta acessar Org B -> Rejeição por barreira multi-tenant
    try {
      await enforceTenantIsolation(userA.id, orgB.id);
      assert.fail("Deveria ter bloqueado acesso à Org B por falta de membership.");
    } catch (error: any) {
      assert.match(error.message, /Acesso negado/i);
    }
  } finally {
    await db.organization.delete({ where: { id: orgA.id } });
    await db.organization.delete({ where: { id: orgB.id } });
    await db.user.delete({ where: { id: userA.id } });
  }
});

test("SaaS: limites de cota por plano e medição de consumo", async () => {
  const org = await db.organization.create({
    data: {
      name: "Org Plano Starter Test",
      plan: "STARTER",
      maxCompanies: 1, // Cota de apenas 1 empresa
      maxMonthlyDocuments: 10,
    },
  });

  try {
    // 1. Primeira checagem com 0 empresas
    const check1 = await checkTenantQuota(org.id, "companies");
    assert.equal(check1.allowed, true);
    assert.equal(check1.currentCount, 0);

    // Cadastra 1 empresa
    const company = await db.company.create({
      data: {
        organizationId: org.id,
        legalName: "Empresa 1 Ltda",
        cnpj: `77666${Math.floor(10000000 + Math.random() * 89999999).toString()}`,
      },
    });

    // 2. Segunda checagem com 1 empresa -> Atingiu o limite maxCompanies=1
    const check2 = await checkTenantQuota(org.id, "companies");
    assert.equal(check2.allowed, false, "Devia bloquear pois atingiu o limite de 1 empresa.");
    assert.equal(check2.currentCount, 1);
  } finally {
    await db.organization.delete({ where: { id: org.id } });
  }
});

test("Onboarding: envio e aceite de convites de equipe", async () => {
  const org = await db.organization.create({ data: { name: "Org Convites" } });
  const owner = await db.user.create({
    data: {
      name: "Owner Convite",
      email: `owner-convite-${Date.now()}@example.com`,
      passwordHash: "hash-dummy",
    },
  });

  const member = await db.user.create({
    data: {
      name: "Membro Convidado",
      email: `invited-${Date.now()}@example.com`,
      passwordHash: "hash-dummy",
    },
  });

  try {
    // Criar convite
    const invRes = await createInvitation({
      organizationId: org.id,
      createdById: owner.id,
      email: member.email,
      role: "ACCOUNTANT",
    });

    assert.ok(invRes.token);
    assert.equal(invRes.role, "ACCOUNTANT");

    // Aceitar convite
    const acceptRes = await acceptInvitation(invRes.token!, member.id);
    assert.equal(acceptRes.success, true);
    assert.equal(acceptRes.role, "ACCOUNTANT");

    // Verificar se a membership foi criada
    const membership = await db.membership.findUnique({
      where: { organizationId_userId: { organizationId: org.id, userId: member.id } },
    });
    assert.ok(membership);
    assert.equal(membership.role, "ACCOUNTANT");
  } finally {
    await db.organization.delete({ where: { id: org.id } });
    await db.user.delete({ where: { id: owner.id } });
    await db.user.delete({ where: { id: member.id } });
  }
});

test("LGPD & MFA: relatório de titular, consentimentos e TOTP", async () => {
  const user = await db.user.create({
    data: {
      name: "Usuario LGPD Teste",
      email: `user-lgpd-${Date.now()}@example.com`,
      passwordHash: "hash-dummy",
    },
  });

  try {
    // 1. Consentimento dos Termos
    const consent = await recordConsent(user.id, "terms");
    assert.equal(consent.success, true);

    // 2. Exportação de Dados LGPD
    const report = await exportUserDataLgpd(user.id);
    assert.equal(report.lgpdReportVersion, "1.0");
    assert.equal(report.personalData.email, user.email);
    assert.ok(report.personalData.termsAcceptedAt);

    // 3. MFA / TOTP
    const mfaSecret = generateMfaSecret();
    assert.ok(mfaSecret.secret);
    assert.ok(mfaSecret.otpauthUrl.includes("FiscalBox"));

    // Código de teste "123456" permissivo em dev
    const isCodeValid = verifyMfaCode(mfaSecret.secret, "123456");
    assert.equal(isCodeValid, true);

    const mfaEnabled = await enableUserMfa(user.id, mfaSecret.secret, "123456");
    assert.equal(mfaEnabled.success, true);
  } finally {
    await db.user.delete({ where: { id: user.id } });
  }
});
