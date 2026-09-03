import test from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit, clearRateLimits } from "../src/lib/security/rate-limit";
import { createPasswordResetToken, validateResetToken, resetPasswordWithToken } from "../src/lib/auth/password-reset";
import { hashPassword, verifyPassword } from "../src/lib/auth/password";
import { db } from "../src/lib/db";

test("Controle de Rate Limiting por IP/identificador", async () => {
  clearRateLimits();
  const testIp = "192.168.1.100";
  const options = { windowMs: 60_000, max: 3, keyPrefix: "test-limit" };

  const res1 = checkRateLimit(testIp, options);
  assert.equal(res1.allowed, true);
  assert.equal(res1.remaining, 2);

  const res2 = checkRateLimit(testIp, options);
  assert.equal(res2.allowed, true);
  assert.equal(res2.remaining, 1);

  const res3 = checkRateLimit(testIp, options);
  assert.equal(res3.allowed, true);
  assert.equal(res3.remaining, 0);

  // Excede limite
  const res4 = checkRateLimit(testIp, options);
  assert.equal(res4.allowed, false, "A quarta tentativa deve ser bloqueada pelo Rate Limiter.");
  assert.equal(res4.remaining, 0);

  clearRateLimits();
});

test("Fluxo completo de recuperação e redefinição de senha", async () => {
  const email = `test-reset-${Date.now()}@example.com`;
  const initialPassword = "InitialPassword123!";
  const passwordHash = await hashPassword(initialPassword);

  const user = await db.user.create({
    data: {
      name: "Usuario Teste Reset",
      email,
      passwordHash,
    },
  });

  // Solocitar token de reset
  const requestRes = await createPasswordResetToken(email);
  assert.equal(requestRes.success, true);
  assert.ok(requestRes.token, "Token retornado em ambiente de teste.");

  const token = requestRes.token!;

  // Validar token
  const validRecord = await validateResetToken(token);
  assert.ok(validRecord, "O token criado deve ser válido.");
  assert.equal(validRecord?.userId, user.id);

  // Redefinir senha
  const newPassword = "NewSecurePassword456!";
  const resetRes = await resetPasswordWithToken(token, newPassword);
  assert.equal(resetRes.success, true);

  // Verificar se a nova senha funciona
  const updatedUser = await db.user.findUnique({ where: { id: user.id } });
  assert.ok(updatedUser);
  const isValid = await verifyPassword(newPassword, updatedUser.passwordHash);
  assert.equal(isValid, true, "A nova senha deve ser verificável via verifyPassword.");

  // Garantir que o token nao pode ser reusado
  const reuseCheck = await validateResetToken(token);
  assert.equal(reuseCheck, null, "Um token já utilizado não deve ser válido.");

  // Cleanup
  await db.user.delete({ where: { id: user.id } });
});
