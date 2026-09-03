import assert from "node:assert/strict";
import test from "node:test";
import { db } from "../src/lib/db";
import { createUserMember, removeMember, updateMemberRole } from "../src/app/actions";
import { login } from "../src/app/auth-actions";
import { authSession, requireAdmin, requireFiscalOperator } from "../src/lib/auth/session";

test("gestao de usuarios, permissoes por papel e rate limit de login", async (t) => {
  // 1. Setup inicial da organizacao e usuario admin
  const org = await db.organization.create({
    data: { name: "Test Org User Management" },
  });

  const adminUser = await db.user.create({
    data: {
      name: "Admin User",
      email: "admin-manage@example.com",
      passwordHash: "dummy-hash",
      memberships: {
        create: { organizationId: org.id, role: "ADMIN" },
      },
    },
  });

  const viewerUser = await db.user.create({
    data: {
      name: "Viewer User",
      email: "viewer-manage@example.com",
      passwordHash: "dummy-hash",
      memberships: {
        create: { organizationId: org.id, role: "VIEWER" },
      },
    },
  });

  // Mock de sessao como ADMIN
  const mockAdminSession = async () => ({
    id: "admin-session-id",
    userId: adminUser.id,
    user: {
      id: adminUser.id,
      name: adminUser.name,
      email: adminUser.email,
      memberships: [
        {
          organizationId: org.id,
          userId: adminUser.id,
          role: "ADMIN" as const,
        },
      ],
    },
  });

  // Mock de sessao como VIEWER
  const mockViewerSession = async () => ({
    id: "viewer-session-id",
    userId: viewerUser.id,
    user: {
      id: viewerUser.id,
      name: viewerUser.name,
      email: viewerUser.email,
      memberships: [
        {
          organizationId: org.id,
          userId: viewerUser.id,
          role: "VIEWER" as const,
        },
      ],
    },
  });

  t.mock.method(authSession, "requireApiSession", mockAdminSession);
  t.mock.method(authSession, "getSession", mockAdminSession);
  t.mock.method(authSession, "requireSession", mockAdminSession);
  t.mock.method(authSession, "requireAdmin", mockAdminSession);

  try {
    // 2. Testar que VIEWER e rejeitado ao tentar acoes fiscais ou administrativas
    t.mock.method(authSession, "requireSession", mockViewerSession);
    await assert.rejects(async () => {
      await requireFiscalOperator();
    }, /Usuário sem permissão/);

    await assert.rejects(async () => {
      await requireAdmin();
    }, /Apenas administradores/);

    // Restaurar mock de ADMIN
    t.mock.method(authSession, "requireSession", mockAdminSession);

    // 3. Testar criacao de novo membro via createUserMember
    const createFormData = new FormData();
    createFormData.append("name", "Novo Operador Fiscal");
    createFormData.append("email", "fiscal-novo@example.com");
    createFormData.append("password", "SenhaSegura123!");
    createFormData.append("role", "ACCOUNTANT");

    await createUserMember(createFormData);

    const createdUser = await db.user.findUnique({
      where: { email: "fiscal-novo@example.com" },
      include: { memberships: true },
    });
    assert.ok(createdUser);
    assert.equal(createdUser.memberships[0].role, "ACCOUNTANT");

    // 4. Testar alteracao de papel via updateMemberRole
    const updateFormData = new FormData();
    updateFormData.append("userId", createdUser.id);
    updateFormData.append("role", "ADMIN");

    await updateMemberRole(updateFormData);

    const updatedMembership = await db.membership.findUnique({
      where: { organizationId_userId: { organizationId: org.id, userId: createdUser.id } },
    });
    assert.equal(updatedMembership?.role, "ADMIN");

    // 5. Testar remocao de membro via removeMember
    const removeFormData = new FormData();
    removeFormData.append("userId", createdUser.id);

    await removeMember(removeFormData);

    const removedMembership = await db.membership.findUnique({
      where: { organizationId_userId: { organizationId: org.id, userId: createdUser.id } },
    });
    assert.equal(removedMembership, null);

    // 6. Testar Rate Limit de login (bloqueio apos 5 tentativas mal sucedidas)
    const targetEmail = "fail-lockout@example.com";
    for (let i = 0; i < 5; i++) {
      await db.auditEntry.create({
        data: {
          organizationId: org.id,
          userId: adminUser.id,
          action: "USER_LOGIN_FAILED",
          entityType: "User",
          metadata: { email: targetEmail },
        },
      });
    }

    const loginFormData = new FormData();
    loginFormData.append("email", targetEmail);
    loginFormData.append("password", "qualquer-senha");

    const loginResult = await login({}, loginFormData);
    assert.ok(loginResult.error);
    assert.match(loginResult.error, /Muitas tentativas incorretas/);

  } finally {
    // Limpeza dos dados de teste
    await db.auditEntry.deleteMany({ where: { organizationId: org.id } });
    await db.user.deleteMany({
      where: {
        email: { in: ["admin-manage@example.com", "viewer-manage@example.com", "fiscal-novo@example.com"] },
      },
    });
    await db.organization.delete({ where: { id: org.id } }).catch(() => undefined);
  }
});
