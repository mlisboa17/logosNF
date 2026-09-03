import assert from "node:assert/strict";
import test from "node:test";
import { GET as exportAuditLogs } from "../src/app/api/audit/export/route";
import { db } from "../src/lib/db";
import { authSession } from "../src/lib/auth/session";

test("exportação de logs de auditoria e governança LGPD", async (t) => {
  const previousKey = process.env.CERTIFICATE_MASTER_KEY_HEX;
  process.env.CERTIFICATE_MASTER_KEY_HEX = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  const testCnpj = `99444${Math.floor(10000000 + Math.random() * 89999999).toString()}`;
  const org = await db.organization.create({ data: { name: "Test Org Audit" } });
  const userAdmin = await db.user.create({
    data: { name: "Admin Audit Test", email: `admin-audit-${testCnpj}@example.com`, passwordHash: "dummy-hash" },
  });
  const userViewer = await db.user.create({
    data: { name: "Viewer Audit Test", email: `viewer-audit-${testCnpj}@example.com`, passwordHash: "dummy-hash" },
  });

  const entry = await db.auditEntry.create({
    data: {
      organizationId: org.id,
      userId: userAdmin.id,
      action: "GOVERNANCE_SECURITY_CHECK",
      entityType: "System",
      entityId: "system-check-1",
      metadata: { checkType: "AUTOMATED_COMPLIANCE" },
    },
  });

  const mockAdminSession = async () => ({
    id: "session-admin-id",
    userId: userAdmin.id,
    user: {
      id: userAdmin.id,
      name: userAdmin.name,
      email: userAdmin.email,
      memberships: [{ organizationId: org.id, userId: userAdmin.id, role: "ADMIN" as const }],
    },
  });

  const mockViewerSession = async () => ({
    id: "session-viewer-id",
    userId: userViewer.id,
    user: {
      id: userViewer.id,
      name: userViewer.name,
      email: userViewer.email,
      memberships: [{ organizationId: org.id, userId: userViewer.id, role: "VIEWER" as const }],
    },
  });

  try {
    // 1. Testar bloqueio de exportacao de auditoria para usuário VIEWER (403 Forbidden)
    t.mock.method(authSession, "requireApiSession", mockViewerSession);
    const forbiddenRes = await exportAuditLogs(new Request("http://localhost/api/audit/export"));
    assert.equal(forbiddenRes.status, 403);

    // 2. Testar exportacao de auditoria para usuário ADMIN (200 OK)
    t.mock.method(authSession, "requireApiSession", mockAdminSession);
    const okRes = await exportAuditLogs(new Request("http://localhost/api/audit/export"));
    assert.equal(okRes.status, 200);

    const csvText = await okRes.text();
    assert.ok(csvText.includes("Data/Hora;Usuario;Email;Acao"));
    assert.ok(csvText.includes("GOVERNANCE_SECURITY_CHECK"));
    assert.ok(csvText.includes(userAdmin.name));

  } finally {
    await db.auditEntry.deleteMany({ where: { organizationId: org.id } });
    await db.organization.delete({ where: { id: org.id } }).catch(() => undefined);
    await db.user.deleteMany({ where: { id: { in: [userAdmin.id, userViewer.id] } } }).catch(() => undefined);

    if (previousKey === undefined) delete process.env.CERTIFICATE_MASTER_KEY_HEX;
    else process.env.CERTIFICATE_MASTER_KEY_HEX = previousKey;
  }
});
