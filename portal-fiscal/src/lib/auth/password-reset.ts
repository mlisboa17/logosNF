import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { logAuditEntry } from "@/lib/auth/session";

const RESET_TOKEN_HOURS = 2;

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createPasswordResetToken(email: string) {
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { memberships: true },
  });

  if (!user) {
    // Retorna mensagem genérica para evitar enumeração de usuários
    return { success: true, message: "Se o e-mail estiver cadastrado, um link de recuperação será enviado." };
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_HOURS * 60 * 60_000);

  // Invalida tokens anteriores não usados
  await db.passwordResetToken.deleteMany({
    where: { userId: user.id, usedAt: null },
  });

  await db.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: tokenHash(token),
      expiresAt,
    },
  });

  await logAuditEntry({
    action: "PASSWORD_RESET_REQUESTED",
    entityType: "USER",
    entityId: user.id,
    userId: user.id,
    organizationId: user.memberships[0]?.organizationId || null,
    metadata: { email: user.email },
  });

  return {
    success: true,
    message: "Se o e-mail estiver cadastrado, um link de recuperação será enviado.",
    // Token retornado para logging/dev se necessário
    token: process.env.NODE_ENV !== "production" ? token : undefined,
  };
}

export async function validateResetToken(token: string) {
  if (!token) return null;

  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { user: true },
  });

  if (!record || record.usedAt || record.expiresAt <= new Date()) {
    return null;
  }

  return record;
}

export async function resetPasswordWithToken(token: string, newPassword: string) {
  if (!newPassword || newPassword.length < 8) {
    throw new Error("A nova senha deve ter no mínimo 8 caracteres.");
  }

  const record = await validateResetToken(token);
  if (!record) {
    throw new Error("Token de redefinição inválido, expirado ou já utilizado.");
  }

  const passwordHash = await hashPassword(newPassword);

  await db.$transaction([
    db.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    db.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    // Invalida todas as sessões ativas por segurança após a troca de senha
    db.session.deleteMany({
      where: { userId: record.userId },
    }),
  ]);

  await logAuditEntry({
    action: "PASSWORD_RESET_COMPLETED",
    entityType: "USER",
    entityId: record.userId,
    userId: record.userId,
    metadata: { resetTokenId: record.id },
  });

  return { success: true, message: "Senha redefinida com sucesso. Faça login com a nova senha." };
}
