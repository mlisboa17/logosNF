"use server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, deleteSession, logAuditEntry, requireSession } from "@/lib/auth/session";
import { auditLogger } from "@/lib/logging";

export type AuthState = { error?: string };

function validPassword(password: string) {
  return password.length >= 12 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}

export async function setupAdmin(_state: AuthState, formData: FormData): Promise<AuthState> {
  if (await db.user.count() > 0) return { error: "A configuração inicial já foi concluída." };
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (name.length < 3 || !/^\S+@\S+\.\S+$/.test(email)) return { error: "Informe nome e e-mail válidos." };
  if (!validPassword(password)) return { error: "Use ao menos 12 caracteres, com maiúscula, minúscula, número e símbolo." };
  const passwordHash = await hashPassword(password);
  const user = await db.$transaction(async (transaction) => {
    const organization = await transaction.organization.upsert({ where: { id: "internal-organization" }, update: {}, create: { id: "internal-organization", name: "Organização principal" } });
    return transaction.user.create({ data: { name, email, passwordHash, memberships: { create: { organizationId: organization.id, role: "OWNER" } } } });
  });
  await createSession(user.id);
  await logAuditEntry({
    action: "ADMIN_SETUP",
    entityType: "User",
    entityId: user.id,
    organizationId: "internal-organization",
    userId: user.id,
  });
  redirect("/");
}

export async function login(_state: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  auditLogger.debug({ email }, "Login attempt initiated");

  const LOCKOUT_MINUTES = 15;
  const MAX_FAILED_ATTEMPTS = 5;
  const windowStart = new Date(Date.now() - LOCKOUT_MINUTES * 60_000);

  const recentFailures = await db.auditEntry.findMany({
    where: {
      action: "USER_LOGIN_FAILED",
      createdAt: { gte: windowStart },
    },
    select: { metadata: true },
  });

  const failuresCount = recentFailures.filter((item) => {
    const meta = item.metadata as { email?: string } | null;
    return meta?.email === email;
  }).length;

  if (failuresCount >= MAX_FAILED_ATTEMPTS) {
    auditLogger.warn({ email, failuresCount }, "Login lockout triggered");
    await logAuditEntry({
      action: "USER_LOGIN_LOCKOUT",
      entityType: "User",
      metadata: { email, failuresCount },
    });
    return { error: `Muitas tentativas incorretas (${failuresCount}). Acesso temporariamente bloqueado por ${LOCKOUT_MINUTES} minutos.` };
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    auditLogger.warn({ email }, "Login failed - invalid credentials");
    await logAuditEntry({
      action: "USER_LOGIN_FAILED",
      entityType: "User",
      metadata: { email },
    });
    return { error: "E-mail ou senha inválidos." };
  }

  await createSession(user.id);
  auditLogger.info({ email, userId: user.id }, "User logged in successfully");
  await logAuditEntry({
    action: "USER_LOGIN",
    entityType: "User",
    entityId: user.id,
    userId: user.id,
  });
  redirect("/");
}

export async function updatePassword(_state: AuthState, formData: FormData): Promise<AuthState> {
  const session = await requireSession();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");

  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    return { error: "Senha atual incorreta." };
  }

  if (!validPassword(newPassword)) {
    return { error: "A nova senha deve ter ao menos 12 caracteres, com maiúscula, minúscula, número e símbolo." };
  }

  const passwordHash = await hashPassword(newPassword);
  await db.user.update({
    where: { id: session.userId },
    data: { passwordHash },
  });

  await logAuditEntry({
    action: "USER_PASSWORD_UPDATE",
    entityType: "User",
    entityId: session.userId,
    userId: session.userId,
  });

  return {};
}

export async function logout() {
  auditLogger.info({}, "User logged out");
  await logAuditEntry({
    action: "USER_LOGOUT",
    entityType: "User",
  });
  await deleteSession();
  redirect("/login");
}
