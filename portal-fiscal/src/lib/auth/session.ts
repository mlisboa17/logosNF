import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

const COOKIE_NAME = "fiscalbox_session";
const SESSION_HOURS = 8;

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60_000);
  await db.session.create({ data: { userId, tokenHash: tokenHash(token), expiresAt } });
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", expires: expiresAt });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: tokenHash(token) } });
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { tokenHash: tokenHash(token) }, include: { user: { include: { memberships: true } } } });
  if (!session || session.expiresAt <= new Date()) return null;
  return session;
}

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireApiSession() {
  const session = await getSession();
  return session;
}

export function organizationIds(session: NonNullable<Awaited<ReturnType<typeof getSession>>>) {
  return session.user.memberships.map((membership) => membership.organizationId);
}

export async function requireFiscalOperator() {
  const session = await authSession.requireSession();
  const allowed = session.user.memberships.some((membership) => membership.role === "OWNER" || membership.role === "ADMIN" || membership.role === "ACCOUNTANT");
  if (!allowed) throw new Error("Usuário sem permissão para esta operação.");
  return session;
}

export async function requireCompanyOperator(companyId: string) {
  const session = await authSession.requireFiscalOperator();
  const allowedOrganizations = session.user.memberships.filter((membership) => membership.role !== "VIEWER").map((membership) => membership.organizationId);
  const company = await db.company.findFirst({ where: { id: companyId, organizationId: { in: allowedOrganizations } }, select: { id: true } });
  if (!company) throw new Error("Empresa não encontrada ou acesso negado.");
  return session;
}

export async function logAuditEntry(input: {
  action: string;
  entityType: string;
  entityId?: string | null;
  organizationId?: string | null;
  userId?: string | null;
  metadata?: any;
}) {
  try {
    let orgId = input.organizationId;
    let userId = input.userId;

    if (!orgId || !userId) {
      const session = await authSession.getSession();
      if (session) {
        if (!userId) userId = session.userId;
        if (!orgId) orgId = session.user.memberships[0]?.organizationId || "internal-organization";
      }
    }

    if (!orgId) orgId = "internal-organization";

    await db.organization.upsert({
      where: { id: orgId },
      update: {},
      create: { id: orgId, name: "Organização principal" },
    });

    await db.auditEntry.create({
      data: {
        organizationId: orgId,
        userId: userId || null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId || null,
        metadata: input.metadata || null,
      },
    });
  } catch (error) {
    console.error("FAILED_TO_LOG_AUDIT", error);
  }
}

export async function requireViewer() {
  const session = await authSession.requireSession();
  if (!session.user.memberships.length) throw new Error("Usuário sem organização associada.");
  return session;
}

export async function requireCompanyViewer(companyId: string) {
  const session = await authSession.requireSession();
  const allowedOrganizations = session.user.memberships.map((m) => m.organizationId);
  const company = await db.company.findFirst({ where: { id: companyId, organizationId: { in: allowedOrganizations } }, select: { id: true } });
  if (!company) throw new Error("Empresa não encontrada ou acesso negado.");
  return session;
}

export async function requireAdmin() {
  const session = await authSession.requireSession();
  const allowed = session.user.memberships.some((membership) => membership.role === "OWNER" || membership.role === "ADMIN");
  if (!allowed) throw new Error("Apenas administradores podem gerenciar a equipe.");
  return session;
}

export const authSession = {
  getSession,
  requireSession,
  requireApiSession,
  requireFiscalOperator,
  requireCompanyOperator,
  requireViewer,
  requireCompanyViewer,
  requireAdmin,
  logAuditEntry,
};

