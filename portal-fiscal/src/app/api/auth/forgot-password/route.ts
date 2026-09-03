import { NextResponse } from "next/server";
import { createPasswordResetToken } from "@/lib/auth/password-reset";
import { checkRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
    const limit = checkRateLimit(ip, { windowMs: 15 * 60_000, max: 5, keyPrefix: "forgot-pw" });

    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Muitas solicitações de redefinição. Tente novamente mais tarde." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "E-mail obrigatório." }, { status: 400 });
    }

    const result = await createPasswordResetToken(email);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Erro ao processar solicitação." }, { status: 500 });
  }
}
