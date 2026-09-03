import { NextResponse } from "next/server";
import { resetPasswordWithToken, validateResetToken } from "@/lib/auth/password-reset";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token ausente." }, { status: 400 });
  }

  const valid = await validateResetToken(token);
  if (!valid) {
    return NextResponse.json({ error: "Token inválido ou expirado." }, { status: 400 });
  }

  return NextResponse.json({ valid: true, email: valid.user.email });
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
    const limit = checkRateLimit(ip, { windowMs: 15 * 60_000, max: 5, keyPrefix: "reset-pw" });

    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Muitas tentativas. Tente novamente mais tarde." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { token, newPassword } = body;

    if (!token || !newPassword) {
      return NextResponse.json({ error: "Token e nova senha são obrigatórios." }, { status: 400 });
    }

    const result = await resetPasswordWithToken(token, newPassword);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erro ao redefinir senha." }, { status: 400 });
  }
}
